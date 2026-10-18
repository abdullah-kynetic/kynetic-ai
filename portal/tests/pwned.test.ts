import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isPwned } from "../src/lib/auth/pwned";

const sha = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();
const stub = (body: string, ok = true): typeof fetch => (async () => new Response(body, { status: ok ? 200 : 503 })) as unknown as typeof fetch;

describe("breached-password check", () => {
  const pw = "correct horse battery staple 99";
  const h = sha(pw);
  it("only sends the first 5 characters of the hash", async () => {
    let url = "";
    const spy = (async (u: string) => { url = u; return new Response(""); }) as unknown as typeof fetch;
    await isPwned(pw, spy);
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${h.slice(0, 5)}`);
    expect(url).not.toContain(h.slice(5));
  });
  it("flags a password whose hash suffix is in the returned range", async () => {
    expect(await isPwned(pw, stub(`ABCDEF:3\r\n${h.slice(5)}:42\r\n`))).toBe(true);
  });
  it("ignores padded decoy rows (count 0) and non-matching rows", async () => {
    expect(await isPwned(pw, stub(`${h.slice(5)}:0\r\n0000000000000000000000000000000000A:9\r\n`))).toBe(false);
  });
  it("fails open on HTTP errors and network failures", async () => {
    expect(await isPwned(pw, stub("", false))).toBe(false);
    expect(await isPwned(pw, (async () => { throw new Error("offline"); }) as unknown as typeof fetch)).toBe(false);
  });
  it("can be switched off", async () => {
    process.env.PWNED_CHECK = "off";
    expect(await isPwned(pw, stub(`${h.slice(5)}:42`))).toBe(false);
    delete process.env.PWNED_CHECK;
  });
});
