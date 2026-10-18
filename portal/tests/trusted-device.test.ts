import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { Client, asAdmin, fx, owner } from "./helpers";

const EMAIL = "admin-mfa2@example.com";
const OTHER = "admin-mfa3@example.com";

type Row = { id: string; session_version: number; totp_secret_enc: string };
async function row(email: string): Promise<Row> {
  const sql = owner();
  try { return (await asAdmin(sql, (tx) => tx<Row[]>`select id, session_version, totp_secret_enc from users where email = ${email}`))[0]; } finally { await sql.end(); }
}
/** Mirrors src/lib/auth/device.ts so the tests exercise the real cookie over real HTTP. */
function mint(u: Row, o: { sv?: number; exp?: number; sub?: string } = {}) {
  const exp = o.exp ?? Math.floor(Date.now() / 1000) + 3600;
  const sv = o.sv ?? u.session_version;
  const fp = createHash("sha256").update(u.totp_secret_enc).digest("hex").slice(0, 16);
  const sig = createHmac("sha256", Buffer.from(fx.env.ENCRYPTION_KEY, "base64")).update(`trusted-device.v1.${u.id}.${exp}.${sv}.${fp}`).digest("base64url");
  return `${o.sub ?? u.id}.${exp}.${sig}`;
}
async function loginWith(cookie: string | null, email = EMAIL, password = fx.pw, totp = "") {
  const c = new Client();
  if (cookie) c.jar.set("kp_td", cookie);
  return c.login(email, password, totp);
}

describe("admin trusted device (remember for 30 days)", () => {
  it("without the cookie the authenticator code is still required", async () => {
    expect(await loginWith(null)).toEqual({ ok: false, code: "mfa_required" });
  });

  it("a valid cookie skips the authenticator code", async () => {
    expect((await loginWith(mint(await row(EMAIL)))).ok).toBe(true);
  });

  it("the cookie never skips the password", async () => {
    const r = await loginWith(mint(await row(EMAIL)), EMAIL, "wrong-password-123");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("invalid");
  });

  it("a wrong code typed alongside a valid cookie is still rejected", async () => {
    const r = await loginWith(mint(await row(EMAIL)), EMAIL, fx.pw, "000000");
    expect(r.ok).toBe(false);
    expect(r.code).toBe("invalid_totp");
  });

  it("is rejected when expired, tampered, for another user, or after the session version changed", async () => {
    const u = await row(EMAIL), o = await row(OTHER);
    expect((await loginWith(mint(u, { exp: Math.floor(Date.now() / 1000) - 10 }))).code).toBe("mfa_required");
    expect((await loginWith(mint(u).replace(/.$/, (ch) => (ch === "A" ? "B" : "A")))).code).toBe("mfa_required");
    expect((await loginWith(mint(o))).code).toBe("mfa_required"); // another admin's cookie
    expect((await loginWith(mint(u, { sv: u.session_version + 1 }))).code).toBe("mfa_required"); // password change revokes
    expect((await loginWith("garbage")).code).toBe("mfa_required");
  });
});
