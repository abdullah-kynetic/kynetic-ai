import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../src");
const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });

describe("static guards", () => {
  it("every exported admin action calls requireAdmin() first", () => {
    const src = readFileSync(path.join(ROOT, "lib/actions/admin.ts"), "utf8");
    const parts = src.split(/export async function /).slice(1);
    expect(parts.length).toBeGreaterThan(8);
    for (const p of parts) {
      const name = p.slice(0, p.indexOf("("));
      const bodyStart = p.indexOf("{\n") + 2;
      expect(p.slice(bodyStart, bodyStart + 80), name).toContain("await requireAdmin()");
    }
  });

  it("every admin page/layout calls requireAdmin() directly or via the shared loader", () => {
    const files = walk(path.join(ROOT, "app/admin")).filter((f) => /\/(page|layout)\.tsx$/.test(f));
    for (const f of files) {
      const s = readFileSync(f, "utf8");
      expect(/requireAdmin\(\)|loadDetail\(/.test(s), f).toBe(true);
    }
    const load = readFileSync(path.join(ROOT, "app/admin/clients/[id]/load.ts"), "utf8");
    expect(load).toContain("requireAdmin()");
  });

  it("every client page calls requireClient() (layout + page)", () => {
    for (const f of walk(path.join(ROOT, "app/(portal)")).filter((f) => /\/(page|layout)\.tsx$/.test(f))) {
      expect(readFileSync(f, "utf8"), f).toContain("requireClient()");
    }
  });

  it("client data functions never accept a clientId parameter", () => {
    const src = readFileSync(path.join(ROOT, "lib/data/client.ts"), "utf8");
    for (const m of src.matchAll(/export async function (\w+)\(([^)]*)\)/g)) expect(m[2], m[1]).not.toMatch(/clientId/i);
  });

  it("no dangerouslySetInnerHTML in app code", () => {
    for (const f of walk(ROOT)) expect(readFileSync(f, "utf8"), f).not.toContain("dangerouslySetInnerHTML");
  });

  it("Google sign-in is gated on the invite-only decision in both Auth.js callbacks", () => {
    const src = readFileSync(path.join(ROOT, "auth.ts"), "utf8");
    expect(src.match(/decideGoogleLogin\(/g)?.length).toBeGreaterThanOrEqual(2);
    expect(src).toContain("return d.ok");
    expect(src).toContain("googleEnabled()");
    expect(src).not.toMatch(/allowDangerousEmailAccountLinking/);
    expect(src).not.toMatch(/insert\(/); // the auth config never creates users
  });
});
