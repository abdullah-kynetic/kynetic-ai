import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { serviceTokens } from '../db/schema';
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

type Options = { db?: Db };

export async function listServiceTokens(
  caller: StaffCaller,
  tenantId: string,
  opts: Options = {}
): Promise<ServiceTokenSummary[]> {
  return asTenantAdmin(caller, tenantId, opts, async (tx) => {
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
  const id = await asTenantAdmin(caller, tenantId, opts, async (tx) => {
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
  return asTenantAdmin(caller, tenantId, opts, async (tx) => {
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
