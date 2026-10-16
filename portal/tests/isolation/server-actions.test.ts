import { beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { Client, asAdmin, base, fx, loginAs, owner } from "../helpers";

/** Finds the build's server-action ids for src/lib/actions/admin.ts and fires them as client A. */
function adminActionIds(): Record<string, string> {
  const dir = path.resolve(__dirname, "../../.next-test/server");
  const f = path.join(dir, "server-reference-manifest.json");
  if (!existsSync(f)) return {};
  const m = JSON.parse(readFileSync(f, "utf8")) as { node: Record<string, { exportedName: string; filename?: string }> };
  const out: Record<string, string> = {};
  for (const [id, v] of Object.entries(m.node)) if ((v.filename ?? "").includes("actions/admin")) out[v.exportedName] = id;
  void readdirSync;
  return out;
}

let a: Client;
beforeAll(async () => { a = await loginAs("client-a2@example.com"); });

async function fire(actionId: string, fields: Record<string, string>) {
  const fd = new FormData();
  fd.set("1_$ACTION_ID_" + actionId, "");
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  // Form-encoded invocation as a plain <form> post to any page, the same way the browser does without JS.
  return fetch(`${base}/admin`, { method: "POST", body: fd, headers: { cookie: a.cookie, "next-action": actionId, accept: "text/x-component" }, redirect: "manual" });
}

describe("admin server actions are unreachable by a client", () => {
  const ids = adminActionIds();
  it("found admin action ids in the build", () => { expect(Object.keys(ids).length).toBeGreaterThan(5); });

  it("client A cannot mutate B via any admin action", async () => {
    const before = owner();
    const snap = async () => asAdmin(before, async (tx) => ({
      contacts: (await tx`select count(*)::int n from contacts where client_id = ${fx.B}`)[0].n,
      scope: (await tx`select count(*)::int n from scope_items where client_id = ${fx.B}`)[0].n,
      users: (await tx`select count(*)::int n from users where client_id = ${fx.B}`)[0].n,
      keys: (await tx`select count(*)::int n from ingest_keys where client_id = ${fx.B} and revoked_at is null`)[0].n,
      docs: (await tx`select count(*)::int n from documents where client_id = ${fx.B}`)[0].n,
      name: (await tx`select name from clients where id = ${fx.B}`)[0].name as string,
    }));
    const s0 = await snap();
    const payloads: Record<string, Record<string, string>> = {
      createClient: { name: "Hacked Co" },
      updateClient: { clientId: fx.B, name: "Hacked" },
      saveProfile: { clientId: fx.B, legalName: "Hacked" },
      saveContact: { clientId: fx.B, name: "Evil", isPrimary: "on" },
      saveScopeItem: { clientId: fx.B, title: "Evil" },
      saveMilestone: { clientId: fx.B, phase: "kickoff", title: "Evil" },
      deleteItem: { clientId: fx.B, id: fx.contactsB[0], kind: "contact" },
      inviteUser: { clientId: fx.B, email: "evil@example.com" },
      setUserDisabled: { clientId: fx.B, userId: fx.clientUserB, disable: "true" },
      createIngestKey: { clientId: fx.B, label: "evil" },
      revokeIngestKey: { clientId: fx.B, keyId: fx.B },
    };
    for (const [name, fields] of Object.entries(payloads)) {
      const id = ids[name];
      expect(id, `action id for ${name}`).toBeTruthy();
      const res = await fire(id, fields);
      const body = await res.text();
      expect(body, name).not.toContain("Test Client B");
      expect(body, name).not.toContain(fx.B);
    }
    const s1 = await snap();
    await before.end();
    expect(s1).toEqual(s0);
  });
});
