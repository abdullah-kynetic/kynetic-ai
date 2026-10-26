import { and, eq } from 'drizzle-orm';
import { getAuthDb, type Db } from '../db/client';
import { getEnv } from '../env';
import * as schema from '../db/schema';
import { createAuth, type Auth } from './create-auth';
import { sessionExpired } from './lifetimes';

export { createAuth, type Auth, type AuthDeps } from './create-auth';
export { evaluateGate } from './gate';
export { LIFETIMES, sessionExpired } from './lifetimes';
export { resetStaffTwoFactor } from './reset-two-factor';

export type AuthUser = {
  id: string;
  email: string;
  name: string | null;
  /** Kynetic staff role, if any. Read from the database on each call (SECURITY 2.1 live checks). */
  kyneticRole: 'admin' | 'va' | null;
  /**
   * Second-factor state (F-98). Client users are 'not_required'. Staff are 'enrol' until TOTP is set
   * up, 'challenge' until this session passes a code, then 'verified'.
   */
  twoFactor: TwoFactorState;
};

export type TwoFactorState = 'not_required' | 'enrol' | 'challenge' | 'verified';

export class SecondFactorRequiredError extends Error {
  constructor(readonly state: 'enrol' | 'challenge') {
    super(`Second factor required: ${state}`);
    this.name = 'SecondFactorRequiredError';
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super('Not signed in');
    this.name = 'UnauthenticatedError';
  }
}

type MagicLinkSender = (msg: { email: string; url: string }) => Promise<void>;

let sender: MagicLinkSender | undefined;
let instance: Auth | undefined;

/** Wired at boot to the email adapter. Until then no link is sent. */
export function setMagicLinkSender(fn: MagicLinkSender): void {
  sender = fn;
}

export function getAuth(): Auth {
  if (!instance) {
    const env = getEnv();
    instance = createAuth({
      db: getAuthDb(),
      baseUrl: env.APP_BASE_URL,
      secret: env.BETTER_AUTH_SECRET,
      google:
        env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
          ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET }
          : undefined,
      sendMagicLink: async (msg) => {
        if (!sender) throw new Error('No email sender is configured for sign-in links');
        await sender(msg);
      }
    });
  }
  return instance;
}

/**
 * The current user for a request, or null. Applies what the library does not: the staff and client
 * lifetimes, and a live check that the user still exists and is not disabled.
 */
export async function getSessionUser(
  headers: Headers,
  deps: { auth?: Auth; db?: Db; now?: Date } = {}
): Promise<AuthUser | null> {
  const auth = deps.auth ?? getAuth();
  const db = deps.db ?? getAuthDb();
  const found = await auth.api.getSession({ headers });
  if (!found) return null;

  const [row] = await db
    .select({
      email: schema.users.email,
      name: schema.users.name,
      kyneticRole: schema.users.kyneticRole,
      disabledAt: schema.users.disabledAt,
      twoFactorEnabled: schema.users.twoFactorEnabled,
      twoFactorVerifiedAt: schema.sessions.twoFactorVerifiedAt,
      createdAt: schema.sessions.createdAt,
      updatedAt: schema.sessions.updatedAt
    })
    .from(schema.sessions)
    .innerJoin(schema.users, eq(schema.users.id, schema.sessions.userId))
    .where(and(eq(schema.sessions.id, found.session.id), eq(schema.users.id, found.user.id)))
    .limit(1);
  if (!row) return null;

  const staff = row.kyneticRole !== null;
  if (row.disabledAt || sessionExpired(row, staff, deps.now ?? new Date())) {
    await db.delete(schema.sessions).where(eq(schema.sessions.id, found.session.id));
    return null;
  }
  return {
    id: found.user.id,
    email: row.email,
    name: row.name,
    kyneticRole: row.kyneticRole as AuthUser['kyneticRole'],
    twoFactor: !staff
      ? 'not_required'
      : !row.twoFactorEnabled
        ? 'enrol'
        : row.twoFactorVerifiedAt
          ? 'verified'
          : 'challenge'
  };
}

/**
 * The signed-in user for a server action or route, or throws UnauthenticatedError. A staff member who
 * has not finished TOTP gets SecondFactorRequiredError, so by default they reach nothing. Only the
 * enrolment and challenge pages pass `allowPendingSecondFactor`.
 */
export async function requireUser(
  headers: Headers,
  opts: { allowPendingSecondFactor?: boolean; deps?: Parameters<typeof getSessionUser>[1] } = {}
): Promise<AuthUser> {
  const user = await getSessionUser(headers, opts.deps);
  if (!user) throw new UnauthenticatedError();
  if (
    !opts.allowPendingSecondFactor &&
    (user.twoFactor === 'enrol' || user.twoFactor === 'challenge')
  )
    throw new SecondFactorRequiredError(user.twoFactor);
  return user;
}
