import { eq, sql } from 'drizzle-orm';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import { users } from '../db/schema';
import { getEnv } from '../env';
import { AppError } from '../errors';
import { isValidCidr } from '../service-auth/address';
import { generateAdminKey } from '../service-auth/token';
import { withPlatform } from '../tenancy';
import type { StaffCaller } from './users';

type Options = { db?: Db; ownerEmail?: string | null };

export type AdminKeySummary = {
  id: string;
  label: string;
  allowedCidrs: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
};

/** Same owner gate as client tokens: one verified admin whose email is SERVICE_API_OWNER_EMAIL. Fails closed. */
async function assertOwner(tx: Tx, caller: StaffCaller, opts: Options) {
  const configured =
    opts.ownerEmail !== undefined ? opts.ownerEmail : getEnv().SERVICE_API_OWNER_EMAIL;
  const owner = configured?.trim().toLowerCase();
  if (!owner || caller.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
  const [user] = await tx
    .select({ email: users.email, verified: users.emailVerified, role: users.kyneticRole })
    .from(users)
    .where(eq(users.id, caller.id))
    .limit(1);
  if (!user || user.role !== 'admin' || !user.verified || user.email.toLowerCase() !== owner)
    throw new AppError('FORBIDDEN');
}

function asOwner<T>(caller: StaffCaller, opts: Options, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withPlatform(
    { userId: caller.id, role: 'admin' },
    async (tx) => {
      await assertOwner(tx, caller, opts);
      return fn(tx);
    },
    { db: opts.db }
  );
}

export async function isAdminKeyOwner(caller: StaffCaller, opts: Options = {}): Promise<boolean> {
  try {
    await asOwner(caller, opts, async () => undefined);
    return true;
  } catch (error) {
    if (error instanceof AppError && error.code === 'FORBIDDEN') return false;
    throw error;
  }
}

export async function listAdminKeys(
  caller: StaffCaller,
  opts: Options = {}
): Promise<AdminKeySummary[]> {
  return asOwner(caller, opts, async (tx) => {
    const rows = await tx.execute<{
      id: string;
      label: string;
      allowed_cidrs: string[];
      last_used_at: string | null;
      revoked_at: string | null;
      created_at: string;
    }>(sql`select * from admin_api_key_list()`);
    return Array.from(rows).map((r) => ({
      id: r.id,
      label: r.label,
      allowedCidrs: r.allowed_cidrs,
      lastUsedAt: r.last_used_at,
      revokedAt: r.revoked_at,
      createdAt: r.created_at
    }));
  });
}

/** Issues an admin key. The raw key is returned once, never stored, never logged. */
export async function issueAdminKey(
  caller: StaffCaller,
  input: { label: string; allowedCidrs: string[] },
  opts: Options = {}
): Promise<{ id: string; key: string }> {
  const label = input.label.trim();
  if (label.length < 1 || label.length > 80)
    throw new AppError('VALIDATION_FAILED', { message: 'Give the key a short label.' });
  const cidrs = input.allowedCidrs.map((c) => c.trim()).filter(Boolean);
  if (cidrs.length > 20 || !cidrs.every(isValidCidr))
    throw new AppError('VALIDATION_FAILED', { message: 'Allowed addresses must be IPs or CIDRs.' });
  const k = generateAdminKey();
  return asOwner(caller, opts, async (tx) => {
    const rows = await tx.execute<{ id: string }>(
      sql`select admin_api_key_issue(${k.prefix}, ${k.keyHash}, ${label}, ${cidrArray(cidrs)}) as id`
    );
    const id = Array.from(rows)[0]!.id;
    await audit(tx, {
      action: 'admin_api_key.issue',
      entity: 'admin_api_key',
      entityId: id,
      after: { label, allowedCidrs: cidrs }
    });
    return { id, key: k.token };
  });
}

function cidrArray(cidrs: string[]) {
  return sql`${`{${cidrs.map((c) => `"${c}"`).join(',')}}`}::text[]`;
}

export async function revokeAdminKey(
  caller: StaffCaller,
  id: string,
  opts: Options = {}
): Promise<boolean> {
  return asOwner(caller, opts, async (tx) => {
    const rows = await tx.execute<{ ok: boolean }>(
      sql`select admin_api_key_revoke(${id}::uuid) as ok`
    );
    const ok = Array.from(rows)[0]?.ok === true;
    if (ok)
      await audit(tx, { action: 'admin_api_key.revoke', entity: 'admin_api_key', entityId: id });
    return ok;
  });
}

/** The stop-all switch: false makes every client token and admin key answer 401 until it is turned back on. */
export async function setServiceApiEnabled(
  caller: StaffCaller,
  enabled: boolean,
  opts: Options = {}
): Promise<boolean> {
  return asOwner(caller, opts, async (tx) => {
    await tx.execute(sql`select service_api_set_enabled(${enabled})`);
    await audit(tx, {
      action: enabled ? 'service_api.enable' : 'service_api.disable',
      entity: 'service_api',
      after: { enabled }
    });
    return enabled;
  });
}

/** Current state of the stop-all switch, for the owner's page. */
export async function getServiceApiEnabled(
  caller: StaffCaller,
  opts: Options = {}
): Promise<boolean> {
  return asOwner(caller, opts, async (tx) => {
    const rows = await tx.execute<{ on: boolean }>(sql`select service_api_enabled() as on`);
    return Array.from(rows)[0]?.on === true;
  });
}
