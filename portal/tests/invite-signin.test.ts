import { createHash, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import postgres from "postgres";
import { Client, asAdmin, base, fx, owner } from "./helpers";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const rand = () => randomBytes(4).toString("hex");
const NEW_PW = "Correct-Horse-Battery-77!";

function actionId(name: string): string {
  const f = path.resolve(__dirname, "../.next-test/server/server-reference-manifest.json");
  if (!existsSync(f)) return "";
  const m = JSON.parse(readFileSync(f, "utf8")) as { node: Record<string, { exportedName: string; filename?: string }> };
  return Object.entries(m.node).find(([, v]) => v.exportedName === name && (v.filename ?? "").includes("auth/actions"))?.[0] ?? "";
}

/** A pending user (no password yet) plus an unused token of the given type. */
async function pending(role: "client" | "admin", type: "invite" | "reset", opts: { totp?: boolean } = {}) {
  const email = `inv-${rand()}@example.com`;
  const raw = randomBytes(24).toString("base64url");
  const sql: postgres.Sql = owner();
  try {
    const id = await asAdmin(sql, async (tx) => (await tx`insert into users (email, role, client_id) values (${email}, ${role}, ${role === "client" ? fx.A : null}) returning id`)[0].id as string);
    if (opts.totp) await asAdmin(sql, (tx) => tx`update users set totp_enabled = true, totp_secret_enc = (select totp_secret_enc from users where email = 'admin-mfa2@example.com') where id = ${id}`);
    await asAdmin(sql, (tx) => tx`insert into auth_tokens (user_id, type, token_hash, expires_at) values (${id}, ${type}, ${sha(raw)}, now() + interval '15 minutes')`);
  } finally { await sql.end(); }
  return { email, token: raw };
}

async function submit(c: Client, action: "acceptInvite" | "resetPassword", token: string) {
  const fd = new FormData();
  const fields: Record<string, string> = { token, password: NEW_PW, confirm: NEW_PW, name: "Test Person" };
  for (const [k, v] of Object.entries(fields)) fd.set(`_1_${k}`, v);
  fd.set("0", JSON.stringify(["$undefined", "$K1"]));
  const page = action === "acceptInvite" ? "invite" : "reset";
  const res = await c.req(`/${page}?token=${token}`, { method: "POST", body: fd, headers: { "next-action": actionId(action), accept: "text/x-component" } });
  return { res, body: await res.text() };
}

describe("invite acceptance signs the user straight in", () => {
  it("a new client is signed in and redirected, with no intermediate screen", async () => {
    const { token } = await pending("client", "invite");
    const c = new Client();
    const { res } = await submit(c, "acceptInvite", token);
    expect(c.hasSession).toBe(true);
    expect(res.headers.get("x-action-redirect") ?? res.headers.get("location") ?? "").toContain("/");
    expect((await c.req("/")).status).toBe(200);
  });

  it("a new admin is signed in but must set up an authenticator before any admin page", async () => {
    const { token } = await pending("admin", "invite");
    const c = new Client();
    await submit(c, "acceptInvite", token);
    expect(c.hasSession).toBe(true);
    const r = await c.req("/admin");
    expect(r.status).toBeGreaterThanOrEqual(300);
    expect(r.headers.get("location") ?? "").toContain("/mfa/setup");
  });

  it("an admin who already has an authenticator is NOT signed in (the code can't be skipped)", async () => {
    const { token } = await pending("admin", "invite", { totp: true });
    const c = new Client();
    const { body } = await submit(c, "acceptInvite", token);
    expect(c.hasSession).toBe(false);
    expect(body).toContain('"ok":true');
  });
});

describe("password reset still ends at the sign-in page", () => {
  it("a client reset does not sign them in, and the new password works afterwards", async () => {
    const { email, token } = await pending("client", "reset");
    const c = new Client();
    const { body } = await submit(c, "resetPassword", token);
    expect(c.hasSession).toBe(false);
    expect(body).toContain('"ok":true');
    expect((await new Client().login(email, NEW_PW)).ok).toBe(true);
  });

  it("an admin reset does not sign them in either", async () => {
    const { token } = await pending("admin", "reset", { totp: true });
    const c = new Client();
    await submit(c, "resetPassword", token);
    expect(c.hasSession).toBe(false);
  });
});
