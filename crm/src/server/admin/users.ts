import { createHash, randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { authorize, ForbiddenError, type Action, type Actor } from '../auth';
import type { Db, Tx } from '../db/client';
import { AppError } from '../errors';
import { withPlatform } from '../tenancy';
import { parseInput } from '../validation';

// Cross-tenant user management (F-61, M8a-03). Every write goes through a SECURITY DEFINER function
// from migration 0031, which re-checks the caller's role and writes the audit row in the same
// transaction. The checks here come first so a refusal never reaches the database, and the matrix in
// auth/permissions.ts stays the one place the rules are written (SECURITY 2.2).

/** Invites expire after 7 days (SECURITY 2.5, decided 2026-10-25). */
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type StaffCaller = { id: string; kyneticRole: 'admin' | 'va' | null };

type Deps = { db?: Db; now?: () => Date };

export type UserRow = {
  userId: string | null;
  invitationId: string | null;
  email: string;
  name: string | null;
  kyneticRole: 'admin' | 'va' | null;
  status: 'active' | 'disabled' | 'invited';
  tenantId: string | null;
  tenantName: string | null;
  membershipRole: 'owner' | 'staff' | null;
  lastLoginAt: Date | null;
  inviteExpiresAt: Date | null;
};

export type InviteDelivery = {
  email: string;
  role: 'owner' | 'staff';
  tenantId: string;
  /** The raw single-use token. It exists only here and in the email; the database keeps a hash. */
  token: string;
  expiresAt: Date;
};

const uuid = z.uuid();
const role = z.enum(['owner', 'staff']);

function callerActor(caller: StaffCaller): Actor {
  return { userId: caller.id, kyneticRole: caller.kyneticRole, membership: null, viewAs: null };
}

function check(
  caller: StaffCaller,
  action: Action
): asserts caller is {
  id: string;
  kyneticRole: 'admin' | 'va';
} {
  authorize(callerActor(caller), action);
  if (!caller.kyneticRole) throw new ForbiddenError();
}

/** Postgres error codes the functions raise, as the standard error codes (SECURITY 5.1). */
function mapDbError(err: unknown): never {
  const code = (e: unknown): string | undefined => {
    const c = (e as { code?: unknown } | null)?.code;
    return typeof c === 'string' ? c : undefined;
  };
  const c = code(err) ?? code((err as { cause?: unknown } | null)?.cause);
  const message = (err as { cause?: { message?: string } } | null)?.cause?.message;
  if (c === '42501') throw new ForbiddenError();
  if (c === 'P0002') throw new AppError('NOT_FOUND');
  if (c === '23505' || c === '23514')
    throw new AppError('CONFLICT', { message: message ?? undefined, cause: err });
  if (c === '22023')
    throw new AppError('VALIDATION_FAILED', { message: message ?? undefined, cause: err });
  throw err;
}

async function call<T>(caller: StaffCaller, deps: Deps, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!caller.kyneticRole) throw new ForbiddenError();
  try {
    return await withPlatform({ userId: caller.id, role: caller.kyneticRole }, fn, { db: deps.db });
  } catch (err) {
    return mapDbError(err);
  }
}

const listSchema = z.object({
  tenantId: uuid.optional(),
  search: z.string().trim().max(200).optional(),
  limit: z.number().int().min(1).max(1000).optional()
});

/** Users and pending invites across tenants. Admin and VA (matrix: Kynetic staff read users). */
export async function listUsers(
  caller: StaffCaller,
  input: z.input<typeof listSchema> = {},
  deps: Deps = {}
): Promise<UserRow[]> {
  check(caller, 'admin.clients.read');
  const f = parseInput(listSchema, input);
  const rows = await call(caller, deps, (tx) =>
    tx.execute(
      sql`select * from admin_list_users(${f.tenantId ?? null}::uuid, ${f.search ?? null}, ${f.limit ?? 200})`
    )
  );
  return (rows as unknown as Record<string, unknown>[]).map((r) => ({
    userId: (r.user_id as string | null) ?? null,
    invitationId: (r.invitation_id as string | null) ?? null,
    email: r.email as string,
    name: (r.name as string | null) ?? null,
    kyneticRole: (r.kynetic_role as UserRow['kyneticRole']) ?? null,
    status: r.status as UserRow['status'],
    tenantId: (r.tenant_id as string | null) ?? null,
    tenantName: (r.tenant_name as string | null) ?? null,
    membershipRole: (r.membership_role as UserRow['membershipRole']) ?? null,
    lastLoginAt: (r.last_login_at as Date | null) ?? null,
    inviteExpiresAt: (r.invite_expires_at as Date | null) ?? null
  }));
}

const inviteSchema = z.object({
  tenantId: uuid,
  email: z.email().max(254),
  role
});

/**
 * Invites a client user (owner or staff) into a tenant. Admin and VA. Creates a single-use token
 * (256 bits, stored as a SHA-256 hash, 7-day expiry) and hands the raw token to `deliver`, which sends
 * the email. The token is never returned or logged. A newer invite for the same email and tenant
 * replaces the older one.
 */
export async function inviteUser(
  caller: StaffCaller,
  input: z.input<typeof inviteSchema>,
  opts: { deliver?: (invite: InviteDelivery) => Promise<void> } & Deps = {}
): Promise<{ invitationId: string; expiresAt: Date; delivered: boolean }> {
  check(caller, 'users.client.invite_reset');
  const f = parseInput(inviteSchema, input);
  const email = f.email.toLowerCase();
  const token = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date((opts.now?.() ?? new Date()).getTime() + INVITE_TTL_MS);
  const rows = await call(caller, opts, (tx) =>
    tx.execute(
      sql`select admin_invite_user(${f.tenantId}::uuid, ${email}, ${f.role}, ${tokenHash}, ${expiresAt.toISOString()}::timestamptz) as id`
    )
  );
  const invitationId = (rows as unknown as { id: string }[])[0].id;
  if (!opts.deliver) return { invitationId, expiresAt, delivered: false };
  await opts.deliver({ email, role: f.role, tenantId: f.tenantId, token, expiresAt });
  return { invitationId, expiresAt, delivered: true };
}

/**
 * Deactivates a user (F-61, SECURITY 2.5): disabled, every session deleted and pending invites revoked,
 * in one transaction. Admin only, and never your own account. A VA is refused before the database.
 */
export async function deactivateUser(
  caller: StaffCaller,
  userId: string,
  deps: Deps = {}
): Promise<void> {
  check(caller, 'users.cross_tenant.manage');
  const id = parseInput(uuid, userId);
  await call(caller, deps, (tx) => tx.execute(sql`select admin_deactivate_user(${id}::uuid)`));
}

/** Lifts a deactivation. Admin only. Memberships were kept, so access returns at the next sign-in. */
export async function reactivateUser(
  caller: StaffCaller,
  userId: string,
  deps: Deps = {}
): Promise<void> {
  check(caller, 'users.cross_tenant.manage');
  const id = parseInput(uuid, userId);
  await call(caller, deps, (tx) => tx.execute(sql`select admin_reactivate_user(${id}::uuid)`));
}

/**
 * Resets a client user's access: signs them out everywhere so they sign in again with Google or a new
 * magic link. Admin and VA, client users only. `notify` emails the person once the reset commits
 * (SECURITY 2.5: a VA-initiated reset is audited and notifies the user).
 */
export async function resetClientUser(
  caller: StaffCaller,
  userId: string,
  opts: { notify?: (userId: string) => Promise<void> } & Deps = {}
): Promise<void> {
  check(caller, 'users.client.invite_reset');
  const id = parseInput(uuid, userId);
  await call(caller, opts, (tx) => tx.execute(sql`select admin_reset_client_user(${id}::uuid)`));
  await opts.notify?.(id);
}

/** Changes a client user's role in one tenant. Admin only. A tenant keeps at least one owner. */
export async function changeMembershipRole(
  caller: StaffCaller,
  input: { tenantId: string; userId: string; role: 'owner' | 'staff' },
  deps: Deps = {}
): Promise<void> {
  check(caller, 'users.cross_tenant.manage');
  const f = parseInput(z.object({ tenantId: uuid, userId: uuid, role }), input);
  await call(caller, deps, (tx) =>
    tx.execute(
      sql`select admin_set_membership_role(${f.tenantId}::uuid, ${f.userId}::uuid, ${f.role})`
    )
  );
}

/**
 * Grants, changes or removes a Kynetic admin or VA role. Admin only, never your own account. The
 * target is signed out so the new role applies from their next sign-in.
 */
export async function changeStaffRole(
  caller: StaffCaller,
  input: { userId: string; role: 'admin' | 'va' | null },
  deps: Deps = {}
): Promise<void> {
  check(caller, 'admin_accounts.manage');
  const f = parseInput(z.object({ userId: uuid, role: z.enum(['admin', 'va']).nullable() }), input);
  await call(caller, deps, (tx) =>
    tx.execute(sql`select admin_change_staff_role(${f.userId}::uuid, ${f.role})`)
  );
}

/** Tenants for the filter and the invite form: id and name only. Admin and VA. */
export async function listTenantOptions(
  caller: StaffCaller,
  deps: Deps = {}
): Promise<{ id: string; name: string }[]> {
  check(caller, 'admin.clients.read');
  const rows = await call(caller, deps, (tx) =>
    tx.execute(sql`select * from admin_tenant_overview()`)
  );
  return (rows as unknown as { tenant_id: string; name: string }[]).map((r) => ({
    id: r.tenant_id,
    name: r.name
  }));
}
