import { getVerifiedSessionUser, type AuthUser } from '../auth';

export type AdminAccess =
  | { kind: 'ok'; user: AuthUser; role: 'admin' | 'va' }
  | { kind: 'sign_in' }
  | { kind: 'second_factor' }
  | { kind: 'forbidden' };

/**
 * Decides who reaches `/admin/*` (F-53 to F-63, SECURITY 2.2). Only users with a Kynetic role pass,
 * and only after TOTP (F-98). The role is read from the database through `getSessionUser` on every
 * call, never from a cookie or token claim. A signed-in client user is `forbidden`, not unknown:
 * the page exists and they may not open it.
 */
export async function decideAdminAccess(
  headers: Headers,
  deps: { getUser?: (headers: Headers) => Promise<AuthUser | null> } = {}
): Promise<AdminAccess> {
  const user = await (deps.getUser ?? getVerifiedSessionUser)(headers);
  if (!user) return { kind: 'sign_in' };
  if (!user.kyneticRole) return { kind: 'forbidden' };
  if (user.twoFactor === 'enrol' || user.twoFactor === 'challenge')
    return { kind: 'second_factor' };
  return { kind: 'ok', user, role: user.kyneticRole };
}
