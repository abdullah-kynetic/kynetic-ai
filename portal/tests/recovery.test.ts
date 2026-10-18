import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client, asAdmin, base, fx, owner, totpNow } from "./helpers";

const [C1, , C3] = fx.recoveryCodes;

function actionId(name: string): string {
  const f = path.resolve(__dirname, "../.next-test/server/server-reference-manifest.json");
  if (!existsSync(f)) return "";
  const m = JSON.parse(readFileSync(f, "utf8")) as { node: Record<string, { exportedName: string; filename?: string }> };
  return Object.entries(m.node).find(([, v]) => v.exportedName === name && (v.filename ?? "").includes("auth/actions"))?.[0] ?? "";
}
async function fire(c: Client, id: string, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(`_1_${k}`, v);
  fd.set("0", JSON.stringify(["$undefined", "$K1"]));
  const res = await fetch(`${base}/account`, { method: "POST", body: fd, headers: { cookie: c.cookie, "x-forwarded-for": c.ip, "next-action": id, accept: "text/x-component" }, redirect: "manual" });
  return res.text();
}

describe("admin recovery codes", () => {
  it("a recovery code signs in an admin whose authenticator is unavailable, exactly once", async () => {
    const first = new Client();
    expect((await first.login("admin-rec@example.com", fx.pw, C1)).ok).toBe(true);
    expect((await first.req("/admin")).status).toBe(200);
    const second = await new Client().login("admin-rec@example.com", fx.pw, C1);
    expect(second.ok).toBe(false);
    expect(second.code).toBe("invalid_totp");
  });

  it("is accepted regardless of case, dashes and spacing", async () => {
    expect((await new Client().login("admin-rec@example.com", fx.pw, "  MNPQR stuvw ")).ok).toBe(true);
  });

  it("a code belonging to one admin does not work for another", async () => {
    const r = await new Client().login("admin-mfa@example.com", fx.pw, C3);
    expect(r.ok).toBe(false);
    expect(r.code).toBe("invalid_totp");
  });

  it("wrong codes are refused and the use is audited", async () => {
    expect((await new Client().login("admin-rec@example.com", fx.pw, "zzzzz-zzzzz")).ok).toBe(false);
    const sql = owner();
    const rows = await asAdmin(sql, (tx) => tx`select meta from audit_log where actor_user_id = ${fx.adminRecId} and action = 'admin.recovery_code_used' order by created_at`);
    await sql.end();
    expect(rows.length).toBe(2);
    expect((rows[1].meta as { remaining: number }).remaining).toBe(1);
  });

  it("regenerating needs the password, replaces every old code, and returns 10 fresh ones", async () => {
    const id = actionId("regenerateRecoveryCodes");
    expect(id).toBeTruthy();
    const c = new Client();
    expect((await c.login("admin-rec@example.com", fx.pw, await totpNow())).ok).toBe(true);
    expect(await fire(c, id, { password: "not-the-password-xx" })).toContain("Password is incorrect.");
    const body = await fire(c, id, { password: fx.pw });
    const m = /"codes":\[((?:"[a-z0-9]{5}-[a-z0-9]{5}",?){10})\]/.exec(body);
    expect(m, "10 codes returned").toBeTruthy();
    const fresh = m![1].replace(/"/g, "").split(",");
    expect(new Set(fresh).size).toBe(10);
    expect((await new Client().login("admin-rec@example.com", fx.pw, C3)).ok).toBe(false); // old unused code is dead
    expect((await new Client().login("admin-rec@example.com", fx.pw, fresh[0])).ok).toBe(true);
  });

  it("only admins with MFA can regenerate; anonymous callers can't", async () => {
    const id = actionId("regenerateRecoveryCodes");
    expect(await fire(new Client(), id, { password: fx.pw })).toContain("Not available.");
    const client = new Client();
    expect((await client.login("client-b@example.com", fx.pw)).ok).toBe(true);
    expect(await fire(client, id, { password: fx.pw })).toContain("Not available.");
  });
});
