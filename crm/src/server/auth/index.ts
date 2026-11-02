import { getAuthDb, type Db } from '../db/client';
import { resolveOpenUser } from './open-mode';
import { ForbiddenError } from './errors';
import { can, type Action, type Actor, type KyneticRole } from './permissions';
import type { AppRole, TenantContext } from '../tenancy/context';

export {
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

/**
 * The current user for a request, or null only when the database has no users at all. There is no
 * sign-in (open mode, see open-mode.ts): the user is picked by the `kynetic_open_as` cookie.
 */
export async function getSessionUser(
  headers: Headers,
  deps: { db?: Db } = {}
): Promise<AuthUser | null> {
  const found = await resolveOpenUser(headers, deps.db ?? getAuthDb());
  if (!found) return null;
  return {
    ...found,
    // Nothing asks Kynetic staff for a code any more, so staff are always treated as verified.
    twoFactor: found.kyneticRole ? 'verified' : 'not_required'
  };
}

/** The user for a server action or route, or throws UnauthenticatedError when the database is empty. */
export async function requireUser(
  headers: Headers,
  opts: { allowPendingSecondFactor?: boolean; deps?: Parameters<typeof getSessionUser>[1] } = {}
): Promise<AuthUser> {
  const user = await getSessionUser(headers, opts.deps);
  if (!user) throw new UnauthenticatedError();
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
