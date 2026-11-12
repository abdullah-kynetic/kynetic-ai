import "server-only";
import { eq, sql } from "drizzle-orm";
import { users } from "../db/schema";
import { withScope } from "../db/scoped";
import { hit, ipFrom } from "../rate-limit";
import { verifyPassword } from "./password";
import { consumeToken, consumeUserToken, issueEmailCode, peekToken } from "./tokens";
import { emails, sendEmail } from "../email";
import { audit } from "../audit";
import { isTrustedDevice } from "./device";

export type AuthResult = { ok: true; userId: string; sessionVersion: number } | { ok: false; code: string };
type User = typeof users.$inferSelect;

const MAX_FAILS = 5;
const LOCK_MIN = 15;

async function findByEmail(email: string): Promise<User | null> {
  const [u] = await withScope({ role: "system" }, (tx) =>
    tx.select().from(users).where(sql`lower(${users.email}) = ${email.toLowerCase()}`).limit(1));
  return u ?? null;
}

async function recordFailure(u: User) {
  const fails = u.failedLogins + 1;
  await withScope({ role: "system" }, (tx) => tx.update(users).set({
    failedLogins: fails,
    lockedUntil: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60_000) : u.lockedUntil,
  }).where(eq(users.id, u.id)));
}

async function recordSuccess(u: User) {
  await withScope({ role: "system" }, (tx) => tx.update(users).set({
    failedLogins: 0, lockedUntil: null, lastLoginAt: new Date(),
  }).where(eq(users.id, u.id)));
}

const isLocked = (u: User) => !!u.lockedUntil && u.lockedUntil > new Date();

export async function authenticatePassword(input: { email: string; password: string; totp: string }, headers: Headers): Promise<AuthResult> {
  const ip = ipFrom(headers);
  if (!(await hit(`login:ip:${ip}`, 30, 15 * 60)) || !(await hit(`login:email:${input.email}`, 10, 15 * 60))) {
    return { ok: false, code: "rate_limited" };
  }
  const u = await findByEmail(input.email);
  const pwOk = await verifyPassword(u?.passwordHash ?? null, input.password);
  if (!u || u.disabledAt) return { ok: false, code: "invalid" };
  if (isLocked(u)) return { ok: false, code: "locked" };
  if (!pwOk) { await recordFailure(u); return { ok: false, code: "invalid" }; }
  if (input.totp.trim() === "" && isTrustedDevice(u, headers)) {
    await recordSuccess(u);
    return { ok: true, userId: u.id, sessionVersion: u.sessionVersion };
  }
  if (!input.totp.trim()) {
    const code = await issueEmailCode(u.id);
    await sendEmail({ to: u.email, ...emails.verificationCode(code) });
    return { ok: false, code: "mfa_required" };
  }
  if (!(await consumeUserToken(input.totp.trim(), "email_code", u.id))) {
    await recordFailure(u);
    return { ok: false, code: "invalid_totp" };
  }
  await recordSuccess(u);
  return { ok: true, userId: u.id, sessionVersion: u.sessionVersion };
}

export async function authenticateMagic(input: { token: string; totp: string }, headers: Headers): Promise<AuthResult> {
  if (!(await hit(`magic:ip:${ipFrom(headers)}`, 30, 15 * 60))) return { ok: false, code: "rate_limited" };
  const peek = await peekToken(input.token, "magic");
  if (!peek) return { ok: false, code: "invalid_link" };
  const u = peek.user;
  if (u.disabledAt) return { ok: false, code: "invalid_link" };
  if (isLocked(u)) return { ok: false, code: "locked" };
  const consumedBy = await consumeToken(input.token, "magic");
  if (consumedBy !== u.id) return { ok: false, code: "invalid_link" };
  await recordSuccess(u);
  return { ok: true, userId: u.id, sessionVersion: u.sessionVersion };
}

/** Called after an allowed Google sign-in: clears any lockout state and records the login. */
export async function recordGoogleLogin(userId: string) {
  await withScope({ role: "system" }, async (tx) => {
    await tx.update(users).set({ failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, userId));
    await audit(tx, { actorUserId: userId, action: "user.login_google" });
  });
}

export { findByEmail };
