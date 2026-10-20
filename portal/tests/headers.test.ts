import { describe, expect, it } from "vitest";
import { Client, loginAs } from "./helpers";

describe("security headers & cookies", () => {
  it("pages carry CSP with nonce, HSTS, frame and sniffing protection", async () => {
    for (const p of ["/login", "/forgot"]) {
      const res = await new Client().req(p);
      const csp = res.headers.get("content-security-policy") ?? "";
      expect(csp, p).toMatch(/script-src 'self' 'nonce-[^']+' 'strict-dynamic'/);
      expect(csp, p).toContain("frame-ancestors 'none'");
      expect(csp, p).toContain("object-src 'none'");
      expect(csp, p).not.toContain("unsafe-eval");
      expect(res.headers.get("strict-transport-security"), p).toContain("max-age=");
      expect(res.headers.get("x-frame-options")).toBe("DENY");
      expect(res.headers.get("x-content-type-options")).toBe("nosniff");
      expect(res.headers.get("referrer-policy")).toBeTruthy();
      expect(res.headers.get("x-powered-by")).toBeNull();
    }
  });

  it("API responses are no-store with a locked-down CSP", async () => {
    const res = await new Client().req("/api/health");
    expect(res.headers.get("cache-control")).toContain("no-store");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
  });

  it("session cookie is HttpOnly + SameSite=Lax", async () => {
    const c = new Client();
    const csrf = await (await c.req("/api/auth/csrf")).json() as { csrfToken: string };
    const res = await c.req("/api/auth/callback/password", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, email: "client-b@example.com", password: "test-password-correct-horse-12", totp: "", json: "true" }) });
    const cookie = res.headers.getSetCookie().find((x) => x.includes("session-token")) ?? "";
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });

  it("login redirect target can't be an open redirect", async () => {
    const a = await loginAs("client-a2@example.com");
    const res = await a.req("/login?next=https://evil.example");
    expect([200, 307]).toContain(res.status);
    if (res.status === 307) expect(res.headers.get("location")).not.toContain("evil.example");
  });
});
