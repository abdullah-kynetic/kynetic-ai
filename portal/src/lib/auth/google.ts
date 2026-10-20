/**
 * Invite-only Google sign-in. Google proves WHO someone is; it never decides WHETHER they get in.
 * Access requires an account an admin already created for that exact email. Nothing is auto-created.
 * Pure (no DB, no server-only) so the rules can be unit tested; the caller injects the user lookup.
 */
export type GoogleProfile = { email?: string | null; email_verified?: boolean | null };
export type LoginUser = { id: string; role: "admin" | "client"; disabledAt: Date | null; sessionVersion: number; clientId: string | null };
export type GoogleDecision =
  | { ok: true; userId: string; sessionVersion: number }
  | { ok: false; reason: "unverified" | "not_invited" | "disabled" | "admin_requires_mfa" };

export async function decideGoogleLogin(
  profile: GoogleProfile,
  findUserByEmail: (email: string) => Promise<LoginUser | null>,
): Promise<GoogleDecision> {
  const email = profile.email?.trim().toLowerCase();
  if (!email || profile.email_verified !== true) return { ok: false, reason: "unverified" };
  const user = await findUserByEmail(email);
  if (!user) return { ok: false, reason: "not_invited" };
  if (user.disabledAt) return { ok: false, reason: "disabled" };
  // Admins must pass TOTP, which an OAuth round-trip can't ask for. They keep password + authenticator.
  if (user.role !== "client" || !user.clientId) return { ok: false, reason: "admin_requires_mfa" };
  return { ok: true, userId: user.id, sessionVersion: user.sessionVersion };
}

export const googleEnabled = () => !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
