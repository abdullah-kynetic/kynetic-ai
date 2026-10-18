/**
 * Test harness: fresh embedded Postgres (:5434) → migrate → seed → extra fixtures → build & start the real
 * app on :3100. Fixture ids/secrets are written to .data/test-fixtures.json for the tests.
 *   TEST_SKIP_BUILD=1  reuse an existing .next-test build
 *   TEST_BASE_URL=...  skip spawning (point at a running server that uses the same DB/env)
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import { hash } from "@node-rs/argon2";
import { generateSecret } from "otplib";
import { startLocalPg } from "../scripts/pg-embedded.mts";

const ROOT = path.resolve(__dirname, "..");
const PORT = 3100;
const PG_PORT = 5434;
const argon = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const PW = "test-password-correct-horse-12";

function enc(plain: string, key: Buffer) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), ct].map((b) => b.toString("base64url")).join(".");
}

let server: ChildProcess | undefined;
let pgStop: (() => Promise<void>) | undefined;

export default async function setup() {
  const env = {
    AUTH_SECRET: randomBytes(32).toString("base64"),
    ENCRYPTION_KEY: randomBytes(32).toString("base64"),
    FILE_SIGNING_SECRET: randomBytes(32).toString("hex"),
    UPLOAD_DIR: path.join(ROOT, ".data/uploads-test"),
  };
  await rm(env.UPLOAD_DIR, { recursive: true, force: true });
  await mkdir(path.join(ROOT, ".data"), { recursive: true });

  const pg = await startLocalPg({ dir: path.join(ROOT, ".data/pg-test"), port: PG_PORT, fresh: true });
  pgStop = pg.stop;
  const baseEnv = { ...process.env, ...env, DATABASE_URL: pg.appUrl, DATABASE_OWNER_URL: pg.ownerUrl, APP_URL: `http://localhost:${PORT}`, AUTH_URL: `http://localhost:${PORT}`, NEXT_DIST_DIR: ".next-test", SEED_CLIENT_PASSWORD: PW, NODE_ENV: "production", PWNED_CHECK: "off" } as NodeJS.ProcessEnv;
  const run = (cmd: string, args: string[]) => {
    const r = spawnSync(cmd, args, { cwd: ROOT, env: baseEnv, stdio: "inherit" });
    if (r.status !== 0) throw new Error(`${cmd} ${args.join(" ")} failed`);
  };
  run("npx", ["tsx", "scripts/migrate.mts"]);
  run("npx", ["tsx", "scripts/seed.mts"]);

  // Extra fixtures (admins with/without MFA, 2nd client-A user, disabled user).
  const sql = postgres(pg.ownerUrl, { max: 1, onnotice: () => {} });
  const key = Buffer.from(env.ENCRYPTION_KEY, "base64");
  const adminTotp = generateSecret();
  const fx = await sql.begin(async (tx) => {
    await tx`select set_config('app.role', 'admin', true)`;
    const clients = await tx`select id, name from clients order by name`;
    const A = clients[0].id as string, B = clients[1].id as string;
    const pw = await hash(PW, argon);
    const mk = async (email: string, role: string, clientId: string | null, extra: Record<string, unknown> = {}) =>
      (await tx`insert into users (email, name, role, client_id, password_hash, totp_secret_enc, totp_enabled, disabled_at)
        values (${email}, ${email}, ${role}, ${clientId}, ${pw}, ${extra.totpEnc ?? null}, ${!!extra.totpEnc}, ${extra.disabled ? new Date() : null}) returning id`)[0].id as string;
    const adminId = await mk("admin-mfa@example.com", "admin", null, { totpEnc: enc(adminTotp, key) });
    await mk("admin-mfa2@example.com", "admin", null, { totpEnc: enc(adminTotp, key) }); // calibration admin (own TOTP replay counter)
    const adminNoMfaId = await mk("admin-nomfa@example.com", "admin", null);
    const aUser2 = await mk("client-a2@example.com", "client", A);
    const disabledId = await mk("disabled@example.com", "client", A, { disabled: true });
    const uid = async (email: string) => (await tx`select id from users where email = ${email}`)[0].id as string;
    const docs = async (c: string) => (await tx`select id, storage_key from documents where client_id = ${c} order by name`) as unknown as { id: string; storage_key: string }[];
    const ids = async (table: string, c: string) => (await tx.unsafe(`select id from ${table} where client_id = $1`, [c])).map((r) => r.id as string);
    const rawKey = (n: string) => { const prefix = randomBytes(6).toString("hex").slice(0, 8); return { prefix, raw: `kp_${prefix}_${randomBytes(24).toString("base64url")}`, n }; };
    const ka = rawKey("A"), kb = rawKey("B"), kr = rawKey("revoked");
    for (const [k, c, revoked] of [[ka, A, false], [kb, B, false], [kr, A, true]] as const) {
      await tx`insert into ingest_keys (client_id, prefix, key_hash, label, revoked_at) values (${c}, ${k.prefix}, ${createHash("sha256").update(k.raw).digest("hex")}, ${k.n}, ${revoked ? new Date() : null})`;
    }
    return {
      A, B, adminId, adminNoMfaId, aUser2, disabledId, clientUserA: await uid("client-a@example.com"), clientUserB: await uid("client-b@example.com"),
      docsA: await docs(A), docsB: await docs(B), contactsB: await ids("contacts", B), milestonesB: await ids("milestones", B), scopeB: await ids("scope_items", B),
      keyA: ka.raw, keyB: kb.raw, keyRevoked: kr.raw,
    };
  });
  await sql.end();

  const fixtures = { ...fx, adminTotp, pw: PW, base: process.env.TEST_BASE_URL ?? `http://localhost:${PORT}`, env, dbOwner: pg.ownerUrl, dbApp: pg.appUrl };
  await writeFile(path.join(ROOT, ".data/test-fixtures.json"), JSON.stringify(fixtures), { mode: 0o600 });

  if (!process.env.TEST_BASE_URL) {
    if (!process.env.TEST_SKIP_BUILD) run("npx", ["next", "build"]);
    server = spawn("npx", ["next", "start", "-p", String(PORT)], { cwd: ROOT, env: baseEnv, stdio: ["ignore", "pipe", "pipe"] });
    const logs: string[] = [];
    server.stdout?.on("data", (d) => logs.push(String(d)));
    server.stderr?.on("data", (d) => logs.push(String(d)));
    await writeFile(path.join(ROOT, ".data/test-server.log"), "");
    server.stdout?.on("data", () => void writeFile(path.join(ROOT, ".data/test-server.log"), logs.join(""))); // best-effort
    for (let i = 0; i < 60; i++) {
      try { if ((await fetch(`http://localhost:${PORT}/api/health`)).ok) break; } catch { /* not up yet */ }
      await new Promise((r) => setTimeout(r, 1000));
      if (i === 59) throw new Error("server did not start:\n" + logs.join(""));
    }
  }
  return async () => {
    server?.kill("SIGTERM");
    await pgStop?.();
  };
}
void randomUUID;
