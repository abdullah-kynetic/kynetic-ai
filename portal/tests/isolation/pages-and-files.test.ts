import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { Client, fx, loginAs, signFile, base } from "../helpers";

const CLIENT_PAGES = ["/", "/profile", "/contacts", "/scope", "/timeline", "/documents", "/results"];
let a: Client; // client A
let b: Client; // client B

beforeAll(async () => { a = await loginAs("client-a@example.com"); b = await loginAs("client-b@example.com"); });

describe("client A can't reach admin or B data", () => {
  it("client pages show A's data and nothing of B", async () => {
    for (const p of CLIENT_PAGES) {
      const { res, body } = await a.text(p);
      expect(res.status, p).toBe(200);
      expect(body, p).toContain("Test Client A");
      expect(body, p).not.toContain("Test Client B");
      expect(body, p).not.toContain("client-b@example.com");
      expect(body, p).not.toContain("owner-b@example.com");
      for (const id of [fx.B, ...fx.docsB.map((d) => d.id), ...fx.contactsB, ...fx.milestonesB, fx.clientUserB]) expect(body, `${p} leaks ${id}`).not.toContain(id);
    }
  });

  it("client pages never show other users' emails (member list)", async () => {
    for (const p of CLIENT_PAGES) {
      const { body } = await a.text(p);
      expect(body, p).not.toContain("client-a2@example.com");
      expect(body, p).not.toContain("admin-mfa@example.com");
    }
  });

  it("admin pages are 404 for a client (own id and B's id)", async () => {
    for (const p of ["/admin", `/admin/clients/${fx.A}`, `/admin/clients/${fx.B}`, `/admin/clients/${fx.B}/users`, `/admin/clients/${fx.B}/keys`, `/admin/clients/${fx.B}/documents`, "/admin/clients/new", "/admin/security"]) {
      const { res, body } = await a.text(p);
      expect(res.status, p).toBe(404);
      expect(body, p).not.toContain("Test Client B");
    }
  });

  it("unauthenticated users are redirected to login", async () => {
    const anon = new Client();
    for (const p of [...CLIENT_PAGES, "/admin", `/admin/clients/${fx.B}`, "/account"]) {
      const res = await anon.req(p);
      expect([302, 303, 307, 308], p).toContain(res.status);
      expect(res.headers.get("location"), p).toContain("/login");
    }
  });
});

describe("file downloads", () => {
  const docB = () => fx.docsB[0];
  const docA = () => fx.docsA[0];

  it("A downloads its own file with a valid signature (bytes match)", async () => {
    const { res, body } = await a.text(signFile(docA().id, fx.clientUserA));
    expect(res.status).toBe(200);
    const onDisk = readFileSync(path.join(fx.env.UPLOAD_DIR, docA().storage_key), "utf8");
    expect(body).toBe(onDisk);
    expect(res.headers.get("content-disposition")).toContain("attachment");
  });

  it("B's file: no signature / forged signature → 404", async () => {
    for (const p of [`/api/files/${docB().id}`, `/api/files/${docB().id}?exp=${Math.floor(Date.now() / 1000) + 600}&sig=${"0".repeat(64)}`]) {
      const res = await a.req(p);
      expect(res.status, p).toBe(404);
    }
  });

  it("B's file with a VALID signature minted for A's user → still 404 (tenant check)", async () => {
    const { res, body } = await a.text(signFile(docB().id, fx.clientUserA));
    expect(res.status).toBe(404);
    expect(body).not.toContain("Test Client B");
  });

  it("A's file with a signature minted for another user → 404", async () => {
    expect((await a.req(signFile(docA().id, fx.clientUserB))).status).toBe(404);
  });

  it("A's signed URL doesn't work for B's session", async () => {
    expect((await b.req(signFile(docA().id, fx.clientUserA))).status).toBe(404);
    expect((await b.req(signFile(docA().id, fx.clientUserB))).status).toBe(404);
  });

  it("expired signature → 404; malformed ids → 404; anonymous → 401", async () => {
    expect((await a.req(signFile(docA().id, fx.clientUserA, -10))).status).toBe(404);
    for (const id of ["../etc/passwd", "not-a-uuid", "00000000-0000-0000-0000-000000000000", "%2e%2e%2f"]) expect((await a.req(`/api/files/${id}`)).status, id).toBe(404);
    expect((await new Client().req(signFile(docA().id, fx.clientUserA))).status).toBe(401);
  });
});

describe("uploads land in the caller's tenant only", () => {
  it("client A upload with clientId=B is stored under A", async () => {
    const fd = new FormData();
    fd.set("file", new File(["hello isolation"], "probe.txt", { type: "text/plain" }));
    fd.set("clientId", fx.B); fd.set("category", "probe");
    const res = await fetch(`${base}/api/documents`, { method: "POST", body: fd, headers: { cookie: a.cookie } });
    expect(res.status).toBe(200);
    const { id } = await res.json() as { id: string };
    const { owner, asAdmin } = await import("../helpers");
    const sql = owner();
    const rows = await asAdmin(sql, (tx) => tx`select client_id from documents where id = ${id}`);
    await sql.end();
    expect(rows[0].client_id).toBe(fx.A);
  });

  it("disallowed type and anonymous uploads are rejected", async () => {
    const fd = new FormData(); fd.set("file", new File(["x"], "evil.exe", { type: "application/x-msdownload" }));
    expect((await fetch(`${base}/api/documents`, { method: "POST", body: fd, headers: { cookie: a.cookie } })).status).toBe(415);
    const fd2 = new FormData(); fd2.set("file", new File(["x"], "a.txt", { type: "text/plain" }));
    expect((await fetch(`${base}/api/documents`, { method: "POST", body: fd2 })).status).toBe(401);
  });
});
