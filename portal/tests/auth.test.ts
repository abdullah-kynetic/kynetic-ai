import { describe, expect, it } from "vitest";
import { createHash, randomBytes } from "node:crypto";
import postgres from "postgres";
import { Client, asAdmin, fx, loginAs, owner, totpNow } from "./helpers";

const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const sys = <T>(sql: postgres.Sql, fn: (tx: postgres.TransactionSql) => Promise<T>) => sql.begin(async (tx) => { await tx`select set_config('app.role','system',true)`; return fn(tx); }) as Promise<T>;

async function mkUser(email: string, role: "client" | "admin" = "client") {
  const sql = owner();
  const id = await asAdmin(sql, async (tx) => (await tx`insert into users (email, role, client_id, password_hash) select ${email}, ${role}, ${role === "client" ? fx.A : null}, password_hash from users where email = 'client-a@example.com' returning id`)[0].id as string);
  await sql.end();
  return id;
}
async function mkToken(userId: string, type: "magic" | "reset" | "invite", ttlMin = 15) {
  const raw = randomBytes(24).toString("base64url");
  const sql = owner();
  await sys(sql, (tx) => tx`insert into auth_tokens (user_id, type, token_hash, expires_at) values (${userId}, ${type}, ${sha(raw)}, now() + make_interval(mins => ${ttlMin}))`);
  await sql.end();
  return raw;
}

describe("password login", () => {
  it("wrong password and unknown user fail with the same error", async () => {
    const a = await new Client().login("client-b@example.com", "wrong-password-xyz");
    const b = await new Client().login("nobody@example.com", "wrong-password-xyz");
    expect(a).toEqual({ ok: false, code: "invalid" });
    expect(b).toEqual({ ok: false, code: "invalid" });
  });

  it("locks the account after 5 failures; correct password then still rejected", async () => {
    await mkUser("lockme@example.com");
    for (let i = 0; i < 5; i++) await new Client().login("lockme@example.com", "bad-password-" + i);
    const r = await new Client().login("lockme@example.com", fx.pw);
    expect(r.ok).toBe(false);
    expect(["locked", "rate_limited"]).toContain(r.code);
  });

  it("disabled users can't sign in", async () => {
    const r = await new Client().login("disabled@example.com", fx.pw);
    expect(r).toEqual({ ok: false, code: "invalid" });
  });

  it("rate limits repeated attempts from one IP", async () => {
    const c = new Client(); let limited = false;
    for (let i = 0; i < 35; i++) { const r = await c.login(`spray${i}@example.com`, "x-password-12345"); if (r.code === "rate_limited") { limited = true; break; } }
    expect(limited).toBe(true);
  });
});

describe("admin MFA", () => {
  it("password alone isn't enough; wrong code rejected; right code works; replay rejected", async () => {
    expect(await new Client().login("admin-mfa@example.com", fx.pw)).toEqual({ ok: false, code: "mfa_required" });
    expect((await new Client().login("admin-mfa@example.com", fx.pw, "000000")).ok).toBe(false);
    const code = await totpNow();
    const c = new Client();
    expect((await c.login("admin-mfa@example.com", fx.pw, code)).ok).toBe(true);
    expect((await c.req("/admin")).status).toBe(200);
    expect((await new Client().login("admin-mfa@example.com", fx.pw, code)).ok).toBe(false); // same step replayed
  });

  it("admin without MFA is sent to enrol and can't open admin pages", async () => {
    const c = await loginAs("admin-nomfa@example.com");
    for (const p of ["/admin", `/admin/clients/${fx.A}`]) {
      const res = await c.req(p);
      expect([302, 307], p).toContain(res.status);
      expect(res.headers.get("location")).toContain("/mfa/setup");
    }
    expect((await c.req(`/api/files/${fx.docsA[0].id}`)).status).toBe(404);
  });

  it("admins can open client detail and see everything; clients can't", async () => {
    const c = new Client();
    await c.login("admin-mfa@example.com", fx.pw, await (async () => { await new Promise((r) => setTimeout(r, 31_000)); return totpNow(); })());
    const { res, body } = await c.text(`/admin/clients/${fx.B}/users`);
    expect(res.status).toBe(200);
    expect(body).toContain("client-b@example.com");
    // Regression: the clients list must show real per-client counts (an unqualified correlated subquery once showed all zeros).
    const list = (await c.text("/admin")).body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    const m = /Test Client A Plan 1 active (\d+) (\d+) (\d+) (\d+)/.exec(list);
    expect(m, "client A row").toBeTruthy();
    const [, users, docs, leads, bookings] = m!.map(Number);
    expect(users).toBeGreaterThan(0); expect(docs).toBeGreaterThan(0); expect(leads).toBeGreaterThan(0); expect(bookings).toBeGreaterThan(0);
  }, 90_000);
});

describe("magic link, reset and invite tokens", () => {
  it("magic link: GET never consumes; POST consumes once; reuse fails", async () => {
    const id = await mkUser("magic1@example.com");
    const token = await mkToken(id, "magic");
    const anon = new Client();
    expect((await anon.req(`/auth/magic?token=${token}`)).status).toBe(200);
    expect((await anon.req(`/auth/magic?token=${token}`)).status).toBe(200); // still valid after GETs
    async function consume(c: Client) {
      const csrf = await (await c.req("/api/auth/csrf")).json() as { csrfToken: string };
      await c.req("/api/auth/callback/magic", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, token, totp: "", json: "true" }) });
      return c.hasSession;
    }
    expect(await consume(new Client())).toBe(true);
    expect(await consume(new Client())).toBe(false);
  });

  it("expired magic link and garbage tokens are rejected", async () => {
    const id = await mkUser("magic2@example.com");
    const token = await mkToken(id, "magic", -5);
    const { body } = await new Client().text(`/auth/magic?token=${token}`);
    expect(body).toContain("Link expired");
    expect((await new Client().text(`/auth/magic?token=nope`)).body).toContain("Link expired");
  });

  it("reset token page works once; token type can't be swapped", async () => {
    const id = await mkUser("reset1@example.com");
    const token = await mkToken(id, "reset");
    expect((await new Client().text(`/reset?token=${token}`)).body).toContain("Choose a new password");
    expect((await new Client().text(`/invite?token=${token}`)).body).toContain("Invite expired"); // wrong type
    expect((await new Client().text(`/auth/magic?token=${token}`)).body).toContain("Link expired");
  });
});

describe("session revocation", () => {
  it("bumping session_version kills an existing session immediately", async () => {
    await mkUser("revoke1@example.com");
    const c = await loginAs("revoke1@example.com");
    expect((await c.req("/")).status).toBe(200);
    const sql = owner();
    await sys(sql, (tx) => tx`update users set session_version = session_version + 1 where email = 'revoke1@example.com'`);
    await sql.end();
    const res = await c.req("/");
    expect([302, 307]).toContain(res.status);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("disabling a user kills their session", async () => {
    await mkUser("revoke2@example.com");
    const c = await loginAs("revoke2@example.com");
    const sql = owner();
    await sys(sql, (tx) => tx`update users set disabled_at = now() where email = 'revoke2@example.com'`);
    await sql.end();
    expect([302, 307]).toContain((await c.req("/")).status);
  });

  it("client can't reach /admin even with a valid session", async () => {
    const c = await loginAs("client-b@example.com");
    expect((await c.req("/admin")).status).toBe(404);
  });
});
