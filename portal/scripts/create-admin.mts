/**
 * Creates (or re-invites) an internal admin and writes a one-time invite link.
 * Usage: DATABASE_OWNER_URL=... APP_URL=https://portal.kyneticai.com node scripts/create-admin.mjs <email> "<name>" [outfile]
 * The invite link is written to [outfile] (chmod 600) if given, else printed to stdout for the operator.
 * After setting a password the admin is forced to enrol TOTP before reaching /admin.
 */
import { createHash, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import postgres from "postgres";

const [email, name, outfile] = process.argv.slice(2);
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error("usage: create-admin <email> <name> [outfile]"); process.exit(1); }
const sql = postgres(process.env.DATABASE_OWNER_URL!, { max: 1, onnotice: () => {} });
const appUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const raw = randomBytes(32).toString("base64url");

await sql.begin(async (tx) => {
  await tx`select set_config('app.role', 'system', true)`;
  const lower = email.toLowerCase();
  const [u] = await tx`select id, role from users where lower(email) = ${lower}`;
  if (u && u.role !== "admin") throw new Error("email belongs to a client user");
  const id = u?.id ?? (await tx`insert into users (email, name, role) values (${lower}, ${name ?? null}, 'admin') returning id`)[0].id;
  await tx`update auth_tokens set used_at = now() where user_id = ${id} and type = 'invite' and used_at is null`;
  await tx`insert into auth_tokens (user_id, type, token_hash, expires_at)
    values (${id}, 'invite', ${createHash("sha256").update(raw).digest("hex")}, now() + interval '7 days')`;
});
await sql.end();
const link = `${appUrl}/invite?token=${raw}`;
if (outfile) { await writeFile(outfile, `${email} ${link}\n`, { mode: 0o600, flag: "a" }); console.log(`[create-admin] invite for ${email} written to ${outfile}`); }
else console.log(`[create-admin] invite link for ${email} (valid 7 days):\n${link}`);
