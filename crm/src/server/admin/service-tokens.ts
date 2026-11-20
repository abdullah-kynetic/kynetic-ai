import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { getEnv } from '../env';
import type { Db, Tx } from '../db/client';
import { serviceTokens, users } from '../db/schema';
import { AppError } from '../errors';
import { SERVICE_TOKEN_SCOPES } from '../service-auth/scopes';
import { generateServiceToken } from '../service-auth/token';
import { asTenantAdmin } from './tenant-admin';
import type { StaffCaller } from './users';

export { SERVICE_TOKEN_SCOPES };

const issueSchema = z.strictObject({
  label: z.string().trim().min(1).max(80),
  scopes: z.array(z.enum(SERVICE_TOKEN_SCOPES)).min(1).max(SERVICE_TOKEN_SCOPES.length)
});

export type ServiceTokenSummary = {
  id: string;
  label: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type Options = {
  db?: Db;
  /** Tests only. Production reads SERVICE_API_OWNER_EMAIL from the environment. */
  ownerEmail?: string | null;
};

/**
 * Only the portal owner manages service tokens, not every Kynetic admin. The owner is the one verified
 * staff account whose email equals SERVICE_API_OWNER_EMAIL. It fails closed: if that setting is missing
 * or blank, nobody can. The database row is read again here, so a stale session cannot pass.
 */
async function assertServiceApiOwner(tx: Tx, caller: StaffCaller, opts: Options) {
  const configured =
    opts.ownerEmail !== undefined ? opts.ownerEmail : getEnv().SERVICE_API_OWNER_EMAIL;
  const owner = configured?.trim().toLowerCase();
  if (!owner) throw new AppError('FORBIDDEN');
  const [user] = await tx
    .select({ email: users.email, verified: users.emailVerified, role: users.kyneticRole })
    .from(users)
    .where(eq(users.id, caller.id))
    .limit(1);
  if (!user || user.role !== 'admin' || !user.verified || user.email.toLowerCase() !== owner) {
    throw new AppError('FORBIDDEN');
  }
}

function asTokenOwner<T>(
  caller: StaffCaller,
  tenantId: string,
  opts: Options,
  fn: (tx: Tx) => Promise<T>
): Promise<T> {
  return asTenantAdmin(caller, tenantId, opts, async (tx) => {
    await assertServiceApiOwner(tx, caller, opts);
    return fn(tx);
  });
}

/** True when this staff account is the portal owner. Used to show or hide the token page only. */
export async function isServiceApiOwner(
  caller: StaffCaller,
  tenantId: string,
  opts: Options = {}
): Promise<boolean> {
  try {
    await asTokenOwner(caller, tenantId, opts, async () => undefined);
    return true;
  } catch (error) {
    if (error instanceof AppError && error.code === 'FORBIDDEN') return false;
    throw error;
  }
}

export async function listServiceTokens(
  caller: StaffCaller,
  tenantId: string,
  opts: Options = {}
): Promise<ServiceTokenSummary[]> {
  return asTokenOwner(caller, tenantId, opts, async (tx) => {
    const rows = await tx
      .select({
        id: serviceTokens.id,
        label: serviceTokens.label,
        scopes: serviceTokens.scopes,
        createdAt: serviceTokens.createdAt,
        lastUsedAt: serviceTokens.lastUsedAt,
        revokedAt: serviceTokens.revokedAt
      })
      .from(serviceTokens)
      .where(eq(serviceTokens.tenantId, tenantId))
      .orderBy(desc(serviceTokens.createdAt))
      .limit(100);
    await audit(tx, {
      action: 'service_token.list',
      entity: 'tenant',
      entityId: tenantId,
      after: { count: rows.length }
    });
    return rows.map((row) => ({ ...row, scopes: row.scopes.filter(Boolean) }));
  });
}

/** The raw token is returned once. Only its hash is stored. */
export async function issueAdminServiceToken(
  caller: StaffCaller,
  tenantId: string,
  input: { label: string; scopes: string[] },
  opts: Options = {}
): Promise<{ id: string; token: string }> {
  const parsed = issueSchema.safeParse({
    ...input,
    scopes: [...new Set(input.scopes)]
  });
  if (!parsed.success)
    throw new AppError('VALIDATION_FAILED', { message: 'Choose a label and at least one scope.' });
  const minted = generateServiceToken();
  const id = await asTokenOwner(caller, tenantId, opts, async (tx) => {
    const [row] = await tx
      .insert(serviceTokens)
      .values({
        tenantId,
        prefix: minted.prefix,
        keyHash: minted.keyHash,
        label: parsed.data.label,
        scopes: parsed.data.scopes
      })
      .returning({ id: serviceTokens.id });
    await audit(tx, {
      action: 'service_token.issue',
      entity: 'service_token',
      entityId: row.id,
      after: { label: parsed.data.label, scopes: parsed.data.scopes }
    });
    return row.id;
  });
  return { id, token: minted.token };
}

export async function revokeAdminServiceToken(
  caller: StaffCaller,
  tenantId: string,
  tokenId: string,
  opts: Options = {}
): Promise<{ revoked: boolean }> {
  if (!z.uuid().safeParse(tokenId).success) throw new AppError('NOT_FOUND');
  return asTokenOwner(caller, tenantId, opts, async (tx) => {
    const rows = await tx
      .update(serviceTokens)
      .set({ revokedAt: new Date().toISOString() })
      .where(
        and(
          eq(serviceTokens.id, tokenId),
          eq(serviceTokens.tenantId, tenantId),
          isNull(serviceTokens.revokedAt)
        )
      )
      .returning({ id: serviceTokens.id });
    const revoked = rows.length > 0;
    await audit(tx, {
      action: 'service_token.revoke',
      entity: 'service_token',
      entityId: tokenId,
      after: { revoked }
    });
    return { revoked };
  });
}
