import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { Client, asAdmin, base, fx, owner, totpNow } from "./helpers";

function ids(): Record<string, string> {
  const f = path.resolve(__dirname, "../.next-test/server/server-reference-manifest.json");
  if (!existsSync(f)) return {};
  const m = JSON.parse(readFileSync(f, "utf8")) as { node: Record<string, { exportedName: string; filename?: string }> };
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(m.node)) if ((v.filename ?? "").includes("actions/admin")) out[v.exportedName] = id;
  return out;
}
const A = ids();
async function act(c: Client, name: string, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(`_1_${k}`, v);
  fd.set("0", JSON.stringify(["$undefined", "$K1"]));
  const res = await fetch(`${base}/admin`, { method: "POST", body: fd, headers: { cookie: c.cookie, "x-forwarded-for": c.ip, "next-action": A[name], accept: "text/x-component" }, redirect: "manual" });
  return res.text();
}
const rand = () => randomBytes(4).toString("hex");
let admin: Client;
const db = owner();
const q = <T>(fn: (tx: import("postgres").TransactionSql) => Promise<T>) => asAdmin(db, fn);
const userRow = (email: string) => q((tx) => tx`select id, email, password_hash is not null as has_pw, session_version from users where lower(email) = ${email.toLowerCase()}`);
beforeAll(async () => {
  admin = new Client();
  expect((await admin.login("admin-mfa3@example.com", fx.pw, await totpNow())).ok).toBe(true);
});

describe("admin user tools", () => {
  it("invite creates a pending user and the Users tab shows when the link expires", async () => {
    const email = `pending-${rand()}@example.com`;
    expect(await act(admin, "inviteUser", { clientId: fx.A, email })).toContain('"ok":true');
    const [u] = await userRow(email);
    expect(u.has_pw).toBe(false);
    const { body } = await admin.text(`/admin/clients/${fx.A}/users`);
    const text = body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    expect(text).toContain(email);
    expect(text).toMatch(/Link expires/);
    expect(text).not.toContain("Link expired");
  });

  it("cancelling an invite removes the pending user, but refuses someone who already has a password", async () => {
    const email = `cancel-${rand()}@example.com`;
    await act(admin, "inviteUser", { clientId: fx.A, email });
    const [u] = await userRow(email);
    expect(await act(admin, "cancelInvite", { clientId: fx.A, userId: u.id })).toContain("Invite cancelled.");
    expect(await userRow(email)).toHaveLength(0);
    expect(await act(admin, "cancelInvite", { clientId: fx.B, userId: fx.clientUserB })).toContain("already set a password");
    expect(await userRow("client-b@example.com")).toHaveLength(1);
  });

  it("sends a reset link only to users who have a password, and only within the stated client", async () => {
    const sys = async () => db.begin(async (tx) => { await tx`select set_config('app.role','system',true)`; return (await tx`select count(*)::int n from auth_tokens where type = 'reset'`)[0].n as number; }) as Promise<number>;
    const before = await sys();
    expect(await act(admin, "sendResetLink", { clientId: fx.B, userId: fx.clientUserB })).toContain('"ok":true');
    expect(await sys()).toBe(before + 1);
    expect(await act(admin, "sendResetLink", { clientId: fx.A, userId: fx.clientUserB })).toContain("User not found.");
    expect(await sys()).toBe(before + 1);
    const email = `nopw-${rand()}@example.com`;
    await act(admin, "inviteUser", { clientId: fx.A, email });
    const [u] = await userRow(email);
    expect(await act(admin, "sendResetLink", { clientId: fx.A, userId: u.id })).toContain("hasn't accepted");
  });

  it("changing an email moves the login, signs the user out, and rejects duplicates and wrong-client ids", async () => {
    const oldEmail = `move-${rand()}@example.com`;
    const newEmail = `moved-${rand()}@example.com`;
    await q((tx) => tx`insert into users (email, role, client_id, password_hash) select ${oldEmail}, 'client', ${fx.A}, password_hash from users where email = 'client-a@example.com'`);
    const [u] = await userRow(oldEmail);
    const session = new Client();
    expect((await session.login(oldEmail, fx.pw)).ok).toBe(true);
    expect((await session.req("/")).status).toBe(200);

    expect(await act(admin, "changeUserEmail", { clientId: fx.A, userId: u.id, email: "client-b@example.com" })).toContain("already belongs");
    expect(await act(admin, "changeUserEmail", { clientId: fx.B, userId: u.id, email: newEmail })).toContain("User not found.");
    expect(await act(admin, "changeUserEmail", { clientId: fx.A, userId: u.id, email: newEmail })).toContain("Email changed");

    expect(await userRow(oldEmail)).toHaveLength(0);
    expect((await session.req("/")).status).toBe(307); // old session is dead
    expect((await new Client().login(oldEmail, fx.pw)).ok).toBe(false);
    expect((await new Client().login(newEmail, fx.pw)).ok).toBe(true);
  });

  it("removing a user deletes them, and only inside the stated client", async () => {
    const email = `gone-${rand()}@example.com`;
    await q((tx) => tx`insert into users (email, role, client_id) values (${email}, 'client', ${fx.A})`);
    const [u] = await userRow(email);
    expect(await act(admin, "removeUser", { clientId: fx.B, userId: u.id })).toContain("User not found.");
    expect(await userRow(email)).toHaveLength(1);
    expect(await act(admin, "removeUser", { clientId: fx.A, userId: u.id })).toContain("User removed.");
    expect(await userRow(email)).toHaveLength(0);
  });

  it("writes an audit trail for each tool", async () => {
    const rows = await q((tx) => tx`select distinct action from audit_log where action in ('user.invite_cancelled','user.reset_link_sent','user.email_changed','user.removed')`);
    expect(rows.map((r) => r.action).sort()).toEqual(["user.email_changed", "user.invite_cancelled", "user.removed", "user.reset_link_sent"]);
  });
});
