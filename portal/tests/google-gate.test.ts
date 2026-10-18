import { describe, expect, it } from "vitest";
import { decideGoogleLogin, type LoginUser } from "../src/lib/auth/google";

const user = (over: Partial<LoginUser> = {}): LoginUser => ({ id: "u1", role: "client", disabledAt: null, sessionVersion: 3, clientId: "c1", ...over });
const lookup = (u: LoginUser | null) => async () => u;

describe("invite-only Google sign-in gate", () => {
  it("lets in an invited client whose Google email is verified", async () => {
    expect(await decideGoogleLogin({ email: "Person@Example.com", email_verified: true }, lookup(user()))).toEqual({ ok: true, userId: "u1", sessionVersion: 3 });
  });
  it("matches the email case-insensitively", async () => {
    let seen = "";
    await decideGoogleLogin({ email: "  MiXed@Example.COM ", email_verified: true }, async (e) => { seen = e; return user(); });
    expect(seen).toBe("mixed@example.com");
  });
  it("turns away anyone without an account, and never creates one", async () => {
    const d = await decideGoogleLogin({ email: "stranger@gmail.com", email_verified: true }, lookup(null));
    expect(d).toEqual({ ok: false, reason: "not_invited" });
  });
  it("refuses an unverified or missing Google email, without even looking up the user", async () => {
    let looked = false;
    const spy = async () => { looked = true; return user(); };
    expect(await decideGoogleLogin({ email: "a@b.com", email_verified: false }, spy)).toEqual({ ok: false, reason: "unverified" });
    expect(await decideGoogleLogin({ email: "a@b.com" }, spy)).toEqual({ ok: false, reason: "unverified" });
    expect(await decideGoogleLogin({ email_verified: true }, spy)).toEqual({ ok: false, reason: "unverified" });
    expect(looked).toBe(false);
  });
  it("refuses disabled users", async () => {
    expect(await decideGoogleLogin({ email: "a@b.com", email_verified: true }, lookup(user({ disabledAt: new Date() })))).toEqual({ ok: false, reason: "disabled" });
  });
  it("keeps admins on password + authenticator (no Google bypass of MFA)", async () => {
    expect(await decideGoogleLogin({ email: "a@b.com", email_verified: true }, lookup(user({ role: "admin", clientId: null })))).toEqual({ ok: false, reason: "admin_requires_mfa" });
  });
  it("refuses a client user that has no client attached", async () => {
    expect((await decideGoogleLogin({ email: "a@b.com", email_verified: true }, lookup(user({ clientId: null })))).ok).toBe(false);
  });
});
