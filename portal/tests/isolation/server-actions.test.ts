import { beforeAll, describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client, asAdmin, base, fx, loginAs, owner, totpNow } from "../helpers";

/*
 * Fires the real admin server actions over HTTP using React's own request encoding
 * (multipart: form fields as "_1_<name>", then "0" = ["$undefined","$K1"]).
 * Non-vacuous by construction: every payload is first sent as an ADMIN against a scratch client and must
 * pass validation (no "Invalid ..." error) and createClient must really create a row. Only then are the
 * same payloads sent as client A against client B, which must change nothing.
 */
function adminActionIds(): Record<string, string> {
  const f = path.resolve(__dirname, "../../.next-test/server/server-reference-manifest.json");
  if (!existsSync(f)) return {};
  const m = JSON.parse(readFileSync(f, "utf8")) as { node: Record<string, { exportedName: string; filename?: string }> };
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(m.node)) if ((v.filename ?? "").includes("actions/admin")) out[v.exportedName] = id;
  return out;
}

async function fire(c: Client, actionId: string, fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(`_1_${k}`, v);
  fd.set("0", JSON.stringify(["$undefined", "$K1"])); // the root entry must come last, as React's encodeReply emits it
  const res = await fetch(`${base}/admin`, { method: "POST", body: fd, headers: { cookie: c.cookie, "next-action": actionId, accept: "text/x-component" }, redirect: "manual" });
  return { status: res.status, body: await res.text() };
}

const ids = adminActionIds();
const payloads = (client: string, user: string, doc: string): Record<string, Record<string, string>> => ({
  createClient: { name: "Scratch Co" },
  updateClient: { clientId: client, name: "Renamed" },
  saveProfile: { clientId: client, legalName: "Renamed" },
  saveContact: { clientId: client, name: "Evil", isPrimary: "on" },
  saveScopeItem: { clientId: client, title: "Evil" },
  saveMilestone: { clientId: client, phase: "kickoff", title: "Evil" },
  deleteItem: { clientId: client, id: doc, kind: "contact" },
  inviteUser: { clientId: client, email: "evil@example.com" },
  setUserDisabled: { clientId: client, userId: user, disable: "true" },
  createIngestKey: { clientId: client, label: "evil" },
  revokeIngestKey: { clientId: client, keyId: doc },
});

describe("admin server actions", () => {
  let admin: Client; let scratch = "";
  beforeAll(async () => {
    admin = new Client();
    expect((await admin.login("admin-mfa2@example.com", fx.pw, await totpNow())).ok).toBe(true);
    const sql = owner();
    const before = await asAdmin(sql, async (tx) => (await tx`select count(*)::int n from clients`)[0].n as number);
    await fire(admin, ids.createClient, { name: "Scratch Co" });
    const rows = await asAdmin(sql, (tx) => tx`select id from clients where name = 'Scratch Co'`);
    await sql.end();
    expect(rows.length, "calibration: createClient as admin really creates a client").toBe(1);
    expect(before).toBe(2);
    scratch = rows[0].id as string;
  });

  it("found the admin action ids in the build", () => { expect(Object.keys(ids).length).toBeGreaterThan(9); });

  it("calibration: every payload is VALID when an admin sends it", async () => {
    for (const [name, fields] of Object.entries(payloads(scratch, randomUUID(), randomUUID()))) {
      if (name === "createClient") continue;
      const { body } = await fire(admin, ids[name], fields);
      expect(body, name).not.toMatch(/"error":"(Invalid|Required|Expected)/);
      expect(body, name).not.toContain("NEXT_HTTP_ERROR_FALLBACK");
    }
  });

  it("client A can't mutate B via any admin action (state unchanged, 404 digest)", async () => {
    const a = await loginAs("client-a2@example.com");
    const sql = owner();
    const snap = () => asAdmin(sql, async (tx) => ({
      clients: (await tx`select count(*)::int n, string_agg(name, ',' order by name) names from clients`)[0],
      contacts: (await tx`select count(*)::int n from contacts where client_id = ${fx.B}`)[0].n,
      scope: (await tx`select count(*)::int n from scope_items where client_id = ${fx.B}`)[0].n,
      milestones: (await tx`select count(*)::int n from milestones where client_id = ${fx.B}`)[0].n,
      users: (await tx`select count(*)::int n, count(disabled_at)::int d from users where client_id = ${fx.B}`)[0],
      keys: (await tx`select count(*)::int n from ingest_keys where client_id = ${fx.B}`)[0].n,
      docs: (await tx`select count(*)::int n from documents where client_id = ${fx.B}`)[0].n,
      profile: (await tx`select legal_name from business_profiles where client_id = ${fx.B}`)[0].legal_name as string,
    }));
    const s0 = await snap();
    for (const [name, fields] of Object.entries(payloads(fx.B, fx.clientUserB, fx.contactsB[0]))) {
      const { body } = await fire(a, ids[name], fields);
      expect(body, `${name} should be refused with a 404 digest`).toContain("NEXT_HTTP_ERROR_FALLBACK;404");
      expect(body, name).not.toContain("Test Client B");
      expect(body, name).not.toContain(fx.B);
    }
    const s1 = await snap();
    await sql.end();
    expect(s1).toEqual(s0);
  });

  it("anonymous callers are refused too", async () => {
    const anon = new Client();
    for (const [name, fields] of Object.entries(payloads(fx.B, fx.clientUserB, fx.contactsB[0]))) {
      const { body } = await fire(anon, ids[name], fields);
      expect(body, name).not.toMatch(/"ok":true/);
    }
  });
});
