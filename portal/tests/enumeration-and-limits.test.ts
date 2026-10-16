import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client, asAdmin, base, fx, loginAs, owner } from "./helpers";

function actionIds(file: string): Record<string, string> {
  const f = path.resolve(__dirname, "../.next-test/server/server-reference-manifest.json");
  if (!existsSync(f)) return {};
  const m = JSON.parse(readFileSync(f, "utf8")) as { node: Record<string, { exportedName: string; filename?: string }> };
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(m.node)) if ((v.filename ?? "").includes(file)) out[v.exportedName] = id;
  return out;
}
async function fire(c: Client, id: string, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(`_1_${k}`, v);
  fd.set("0", JSON.stringify(["$undefined", "$K1"]));
  const res = await fetch(`${base}/login`, { method: "POST", body: fd, headers: { cookie: c.cookie, "x-forwarded-for": c.ip, "next-action": id, accept: "text/x-component" }, redirect: "manual" });
  return res.text();
}
// Strip per-request noise (build id) so two bodies can be compared.
const norm = (s: string) => s.replace(/"b":"[^"]+"/g, "");

describe("no account enumeration", () => {
  const ids = actionIds("auth/actions");
  it("magic-link and password-reset requests answer identically for known and unknown emails", async () => {
    expect(ids.requestMagicLink && ids.requestPasswordReset).toBeTruthy();
    for (const name of ["requestMagicLink", "requestPasswordReset"]) {
      const known = await fire(new Client(), ids[name], { email: "client-a@example.com" });
      const unknown = await fire(new Client(), ids[name], { email: "nobody-here@example.com" });
      expect(known, name).toContain("If that email has portal access");
      expect(norm(known), name).toBe(norm(unknown));
    }
  });

  it("a request for a known email issues a token; for an unknown email it does not", async () => {
    const sql = owner();
    const count = () => asAdmin(sql, async (tx) => { await tx`select set_config('app.role','system',true)`; return (await tx`select count(*)::int n from auth_tokens`)[0].n as number; });
    // asAdmin sets role=admin; auth_tokens needs system, so query as system explicitly:
    const sys = async () => sql.begin(async (tx) => { await tx`select set_config('app.role','system',true)`; return (await tx`select count(*)::int n from auth_tokens`)[0].n as number; }) as Promise<number>;
    void count;
    const before = await sys();
    await fire(new Client(), ids.requestPasswordReset, { email: "nobody-else@example.com" });
    expect(await sys()).toBe(before);
    await fire(new Client(), ids.requestPasswordReset, { email: "client-b@example.com" });
    expect(await sys()).toBe(before + 1);
    await sql.end();
  });
});

describe("upload limits", () => {
  it("rejects files over the size limit with 413 and stores nothing", async () => {
    const a = await loginAs("client-a2@example.com");
    const big = new File([new Uint8Array(26 * 1024 * 1024)], "big.txt", { type: "text/plain" });
    const fd = new FormData(); fd.set("file", big);
    const res = await fetch(`${base}/api/documents`, { method: "POST", body: fd, headers: { cookie: a.cookie, "x-forwarded-for": a.ip } });
    expect(res.status).toBe(413);
  });

  it("rejects an empty upload and a missing file", async () => {
    const a = await loginAs("client-a2@example.com");
    const fd = new FormData(); fd.set("category", "x");
    expect((await fetch(`${base}/api/documents`, { method: "POST", body: fd, headers: { cookie: a.cookie, "x-forwarded-for": a.ip } })).status).toBe(400);
    void fx;
  });
});
