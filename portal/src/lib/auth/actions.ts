"use server";
import { AuthError } from "next-auth";
import { eq } from "drizzle-orm";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import QRCode from "qrcode";
import { signIn, signOut } from "@/auth";
import { users } from "../db/schema";
import { withScope } from "../db/scoped";
import { hit, clientIp } from "../rate-limit";
import { emails, sendEmail } from "../email";
import { env } from "../env";
import { encrypt, decrypt } from "../crypto";
import { audit } from "../audit";
import { consumeToken, issueToken } from "./tokens";
import { findByEmail } from "./authenticate";
import { hashPassword, newPasswordProblem, verifyPassword } from "./password";
import { newTotpSecret, totpUri, checkTotp } from "./totp";
import { generateRecoveryCodes } from "./recovery";
import { getSession, requireUser } from "./session";

export type FormState = { error?: string; code?: string; ok?: boolean; message?: string; codes?: string[] } | undefined;

const MESSAGES: Record<string, string> = {
  invalid: "Incorrect email or password.",
  locked: "Too many failed attempts. Try again in 15 minutes.",
  rate_limited: "Too many attempts. Please wait a few minutes.",
  mfa_required: "Enter the 6-digit code from your authenticator app.",
  invalid_totp: "That code didn't work. Try the next one.",
  invalid_link: "This link is invalid, expired, or already used.",
};

function authFailure(e: unknown): FormState {
  unstable_rethrow(e);
  if (e instanceof AuthError) {
    const code = (e as AuthError & { code?: string }).code ?? "invalid";
    return { code, error: MESSAGES[code] ?? MESSAGES.invalid };
  }
  throw e;
}

/** Only allow same-site relative redirects. */
const safeNext = (v: unknown) => (typeof v === "string" && v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : "/");

export async function loginWithPassword(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await signIn("password", {
      email: fd.get("email"), password: fd.get("password"), totp: fd.get("totp") ?? "",
      redirectTo: safeNext(fd.get("next")),
    });
  } catch (e) { return authFailure(e); }
}

export async function loginWithMagic(_: FormState, fd: FormData): Promise<FormState> {
  try {
    await signIn("magic", { token: fd.get("token"), totp: fd.get("totp") ?? "", redirectTo: "/" });
  } catch (e) { return authFailure(e); }
}

const emailSchema = z.string().trim().toLowerCase().email().max(254);

/** Always responds the same way whether or not the email exists (no account enumeration). */
export async function requestMagicLink(_: FormState, fd: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(fd.get("email"));
  const generic: FormState = { ok: true, message: "If that email has portal access, a sign-in link is on its way." };
  if (!email.success) return { error: "Enter a valid email address." };
  if (!(await hit(`magicreq:ip:${await clientIp()}`, 10, 15 * 60)) || !(await hit(`magicreq:email:${email.data}`, 3, 15 * 60))) return generic;
  const u = await findByEmail(email.data);
  if (u && !u.disabledAt && u.passwordHash) {
    const token = await issueToken(u.id, "magic");
    await sendEmail({ to: u.email, ...emails.magic(`${env.appUrl}/auth/magic?token=${token}`) });
  }
  return generic;
}

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(fd.get("email"));
  const generic: FormState = { ok: true, message: "If that email has portal access, a reset link is on its way." };
  if (!email.success) return { error: "Enter a valid email address." };
  if (!(await hit(`reset:ip:${await clientIp()}`, 10, 15 * 60)) || !(await hit(`reset:email:${email.data}`, 3, 15 * 60))) return generic;
  const u = await findByEmail(email.data);
  if (u && !u.disabledAt) {
    const token = await issueToken(u.id, "reset");
    await sendEmail({ to: u.email, ...emails.reset(`${env.appUrl}/reset?token=${token}`) });
  }
  return generic;
}

/** Shared by password reset and invite acceptance. Bumps session_version so other sessions die. */
async function setPasswordWithToken(fd: FormData, type: "reset" | "invite"): Promise<FormState> {
  if (!(await hit(`settoken:ip:${await clientIp()}`, 20, 15 * 60))) return { error: MESSAGES.rate_limited };
  const token = String(fd.get("token") ?? "");
  const pw = String(fd.get("password") ?? "");
  if (pw !== String(fd.get("confirm") ?? "")) return { error: "Passwords don't match." };
  const problem = await newPasswordProblem(pw);
  if (problem) return { error: problem };
  const name = String(fd.get("name") ?? "").trim().slice(0, 120);
  const userId = await consumeToken(token, type);
  if (!userId) return { error: MESSAGES.invalid_link };
  const passwordHash = await hashPassword(pw);
  let notifyEmail: string | null = null;
  await withScope({ role: "system" }, async (tx) => {
    const [u] = await tx.select({ sv: users.sessionVersion, clientId: users.clientId, email: users.email }).from(users).where(eq(users.id, userId));
    notifyEmail = u?.email ?? null;
    await tx.update(users).set({
      passwordHash, failedLogins: 0, lockedUntil: null, sessionVersion: (u?.sv ?? 1) + 1,
      ...(type === "invite" && name ? { name } : {}),
    }).where(eq(users.id, userId));
    await audit(tx, { actorUserId: userId, clientId: u?.clientId, action: type === "invite" ? "user.invite_accepted" : "user.password_reset" });
  });
  if (type === "reset" && notifyEmail) await sendEmail({ to: notifyEmail, ...emails.passwordChanged() }).catch(() => {});
  return { ok: true, message: type === "invite" ? "Account ready — sign in with your new password." : "Password updated — sign in with your new password." };
}

export async function resetPassword(_: FormState, fd: FormData) { return setPasswordWithToken(fd, "reset"); }
export async function acceptInvite(_: FormState, fd: FormData) { return setPasswordWithToken(fd, "invite"); }

export async function logout(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

/** Signs out all of this user's sessions (bumps session_version). */
export async function logoutEverywhere(): Promise<void> {
  const s = await requireUser();
  await withScope({ role: "system" }, async (tx) => {
    const [u] = await tx.select({ sv: users.sessionVersion }).from(users).where(eq(users.id, s.userId));
    await tx.update(users).set({ sessionVersion: (u?.sv ?? 1) + 1 }).where(eq(users.id, s.userId));
  });
  await signOut({ redirectTo: "/login" });
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const s = await requireUser();
  if (!(await hit(`changepw:user:${s.userId}`, 10, 15 * 60))) return { error: MESSAGES.rate_limited };
  const current = String(fd.get("current") ?? "");
  const pw = String(fd.get("password") ?? "");
  if (pw !== String(fd.get("confirm") ?? "")) return { error: "Passwords don't match." };
  const problem = await newPasswordProblem(pw);
  if (problem) return { error: problem };
  const u = await findByEmail(s.email);
  if (!u || !(await verifyPassword(u.passwordHash, current))) return { error: "Current password is incorrect." };
  const passwordHash = await hashPassword(pw);
  await withScope({ role: "system" }, (tx) => tx.update(users).set({ passwordHash, sessionVersion: u.sessionVersion + 1 }).where(eq(users.id, u.id)));
  await sendEmail({ to: u.email, ...emails.passwordChanged() }).catch(() => {});
  await signOut({ redirectTo: "/login?changed=1" });
  return { ok: true };
}

// ---- Admin TOTP enrolment ----------------------------------------------------------------------

/** Starts (or restarts) TOTP enrolment for the signed-in admin. Secret is stored encrypted, not yet enabled. */
export async function startTotpEnrolment(): Promise<{ qrDataUrl: string; secret: string } | null> {
  const s = await getSession();
  if (!s || s.role !== "admin" || s.totpEnabled) return null;
  const secret = newTotpSecret();
  await withScope({ role: "system" }, (tx) => tx.update(users).set({ totpSecretEnc: encrypt(secret) }).where(eq(users.id, s.userId)));
  const uri = totpUri(s.email, secret);
  return { qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }), secret };
}

export async function confirmTotpEnrolment(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s || s.role !== "admin" || s.totpEnabled) return { error: "Not available." };
  if (!(await hit(`totpenrol:user:${s.userId}`, 10, 15 * 60))) return { error: MESSAGES.rate_limited };
  const u = await findByEmail(s.email);
  if (!u?.totpSecretEnc) return { error: "Start enrolment again." };
  const step = await checkTotp(decrypt(u.totpSecretEnc), String(fd.get("code") ?? ""), null);
  if (step === null) return { error: MESSAGES.invalid_totp };
  await withScope({ role: "system" }, async (tx) => {
    await tx.update(users).set({ totpEnabled: true, totpLastStep: step }).where(eq(users.id, u.id));
    await audit(tx, { actorUserId: u.id, action: "admin.mfa_enrolled" });
  });
  const codes = await generateRecoveryCodes(u.id);
  await sendEmail({ to: u.email, ...emails.mfaEnrolled() }).catch(() => {});
  return { ok: true, codes };
}

/** Admin-only: replace all recovery codes. Re-checks the password because this is a sensitive action. */
export async function regenerateRecoveryCodes(_: FormState, fd: FormData): Promise<FormState> {
  const s = await getSession();
  if (!s || s.role !== "admin" || !s.totpEnabled) return { error: "Not available." };
  if (!(await hit(`recovery:user:${s.userId}`, 5, 15 * 60))) return { error: MESSAGES.rate_limited };
  const u = await findByEmail(s.email);
  if (!u || !(await verifyPassword(u.passwordHash, String(fd.get("password") ?? "")))) return { error: "Password is incorrect." };
  const codes = await generateRecoveryCodes(u.id);
  await withScope({ role: "system" }, (tx) => audit(tx, { actorUserId: u.id, action: "admin.recovery_codes_regenerated" }));
  await sendEmail({ to: u.email, ...emails.recoveryRegenerated() }).catch(() => {});
  return { ok: true, codes };
}
