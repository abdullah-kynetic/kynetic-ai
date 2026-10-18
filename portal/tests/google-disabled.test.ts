import { describe, expect, it } from "vitest";
import { Client } from "./helpers";

// The test server runs without AUTH_GOOGLE_ID/SECRET, which is the default until Abdullah creates the Google client.
describe("Google sign-in is off until configured", () => {
  it("offers no Google provider and no button", async () => {
    const c = new Client();
    const providers = await (await c.req("/api/auth/providers")).json() as Record<string, unknown>;
    expect(Object.keys(providers).sort()).toEqual(["magic", "password"]);
    const { body } = await c.text("/login");
    expect(body).not.toContain("Continue with Google");
  });
  it("starting the Google flow does nothing when it is not configured", async () => {
    const c = new Client();
    const res = await c.req("/api/auth/signin/google", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: "" });
    expect([302, 303, 400, 404]).toContain(res.status);
    expect(res.headers.get("location") ?? "").not.toContain("accounts.google.com");
  });
  it("shows a clear message when a Google account is turned away", async () => {
    const { body } = await new Client().text("/login?error=AccessDenied");
    expect(body).toContain("hasn&#x27;t been invited");
  });
});
