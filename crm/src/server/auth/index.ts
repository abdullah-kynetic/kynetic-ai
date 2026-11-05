import { getAuthDb } from '../db/client';
import { personaFromHeaders, personaSwitchingEnabled, resolveOpenUser } from './open-mode';
import { createAuth, type Auth } from './create-auth';
import { getEnv } from '../env';
import { getVerifiedSessionUser, type SessionDeps } from './session';
export { getVerifiedSessionUser } from './session';
export { createAuth, type Auth, type AuthDeps } from './create-auth';
export { evaluateGate } from './gate';
export { resetStaffTwoFactor } from './reset-two-factor';
import { ForbiddenError } from './errors';
import { can, type Action, type Actor, type KyneticRole } from './permissions';
import type { AppRole, TenantContext } from '../tenancy/context';

export {
  personaSwitchingEnabled,
  OPEN_AS_COOKIE,
  OPEN_PERSONAS,
  isOpenPersona,
  personaFromHeaders,
  type OpenPersona
} from './open-mode';

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

// Kept on globalThis so the sender wired in instrumentation is visible to route handlers.
const SENDER_KEY = Symbol.for('kynetic.magicLinkSender');
type SenderSlot = { [SENDER_KEY]?: MagicLinkSender };
let instance: Auth | undefined;

/** Wired at boot to the email adapter. Until then no link is sent. */
export function setMagicLinkSender(fn: MagicLinkSender | undefined): void {
  (globalThis as SenderSlot)[SENDER_KEY] = fn;
}

/** Deliver an auth-only sign-in message through the configured transactional email provider. */
export async function sendMagicLinkEmail(msg: { email: string; url: string }): Promise<void> {
  const sender = (globalThis as SenderSlot)[SENDER_KEY];
  if (!sender) throw new Error('No email sender is configured for sign-in links');
  await sender(msg);
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
        await sendMagicLinkEmail(msg);
      }
    });
  }
  return instance;
}

/** Only verified sessions authenticate. A verified admin may opt into local persona previews. */
export async function getSessionUser(
  headers: Headers,
  deps: SessionDeps = {}
): Promise<AuthUser | null> {
  const user = await getVerifiedSessionUser(headers, deps);
  if (!user) return null;
  if (
    !personaFromHeaders(headers) ||
    user.kyneticRole !== 'admin' ||
    user.twoFactor !== 'verified' ||
    !personaSwitchingEnabled()
  )
    return user;
  const selected = await resolveOpenUser(headers, deps.db ?? getAuthDb());
  return selected
    ? { ...selected, twoFactor: selected.kyneticRole ? user.twoFactor : 'not_required' }
    : user;
}

/** The user for a server action or route, or throws UnauthenticatedError when the database is empty. */
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

export { ForbiddenError } from './errors';
export {
  can,
  MATRIX,
  type Action,
  type Actor,
  type KyneticRole,
  type TenantRole
} from './permissions';
export { resolveActor } from './actor';

/** Throws ForbiddenError unless the actor may do `action` (in `tenantId`, when the action is tenant-scoped). */
export function authorize(actor: Actor, action: Action, tenantId?: string): void {
  if (!can(actor, action, tenantId)) throw new ForbiddenError();
}

/** For code that already holds a TenantContext: the context role must be one of `roles`. */
export function requireRole(ctx: Pick<TenantContext, 'role'>, roles: readonly AppRole[]): void {
  if (!roles.includes(ctx.role)) throw new ForbiddenError();
}

/** The caller must be Kynetic staff, and that specific role when one is named. */
export function requireKynetic(
  user: Pick<AuthUser, 'kyneticRole'>,
  role?: KyneticRole
): asserts user is { kyneticRole: KyneticRole } {
  if (!user.kyneticRole || (role && user.kyneticRole !== role)) throw new ForbiddenError();
}
