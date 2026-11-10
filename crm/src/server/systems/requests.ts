import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authorize, type Actor } from '../auth';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { systemRequests } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { loadEnabledModules } from '../modules';
import { MODULE_KEYS, moduleSatisfied, type ModuleKey } from '../modules/keys';
import { withPlatform, withTenant, type TenantContextInput } from '../tenancy';

type Options = { db?: Db };
type StaffContext = { userId: string; role: 'admin' | 'va' };

const requestSchema = z.object({ moduleKey: z.enum(MODULE_KEYS) }).strict();

export type SystemRequestRow = {
  id: string;
  moduleKey: ModuleKey;
  createdAt: string;
};

export type SystemRequestQueueRow = SystemRequestRow & { tenantId: string; tenantName: string };

function pgCode(err: unknown): string | undefined {
  for (
    let current: unknown = err;
    current && typeof current === 'object';
    current = (current as { cause?: unknown }).cause
  ) {
    const code = (current as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** A client asks for a system that is off. A second request for the same system is the same row. */
export async function requestSystem(
  ctx: TenantContextInput,
  actor: Actor,
  input: unknown,
  opts: Options = {}
): Promise<{ id: string; created: boolean }> {
  authorize(actor, 'tenant_data.write', ctx.tenantId);
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success || parsed.data.moduleKey === 'platform')
    throw new ValidationError({ module: ['invalid'] });
  const moduleKey = parsed.data.moduleKey;
  return withTenant(
    ctx,
    async (tx) => {
      const enabled = await loadEnabledModules(ctx, { tx });
      if (moduleSatisfied(enabled, { module: moduleKey }))
        throw new AppError('CONFLICT', { message: 'That system is already on.' });
      const [existing] = await tx
        .select({ id: systemRequests.id })
        .from(systemRequests)
        .where(
          and(eq(systemRequests.tenantId, ctx.tenantId), eq(systemRequests.moduleKey, moduleKey))
        )
        .limit(1);
      if (existing) return { id: existing.id, created: false };
      try {
        const [row] = await tx
          .insert(systemRequests)
          .values({
            tenantId: ctx.tenantId,
            moduleKey,
            requestedBy: actor.userId
          })
          .returning({ id: systemRequests.id });
        await audit(tx, {
          action: 'system.request',
          entity: 'system_request',
          entityId: row!.id,
          after: { moduleKey }
        });
        return { id: row!.id, created: true };
      } catch (error) {
        if (pgCode(error) !== '23505') throw error;
        const [again] = await tx
          .select({ id: systemRequests.id })
          .from(systemRequests)
          .where(
            and(eq(systemRequests.tenantId, ctx.tenantId), eq(systemRequests.moduleKey, moduleKey))
          )
          .limit(1);
        if (!again) throw error;
        return { id: again.id, created: false };
      }
    },
    opts
  );
}

export async function listOwnSystemRequests(
  ctx: TenantContextInput,
  actor: Actor,
  opts: Options = {}
): Promise<SystemRequestRow[]> {
  authorize(actor, 'tenant_data.read', ctx.tenantId);
  return withTenant(
    ctx,
    async (tx) => {
      const rows = await tx
        .select({
          id: systemRequests.id,
          moduleKey: systemRequests.moduleKey,
          createdAt: systemRequests.createdAt
        })
        .from(systemRequests)
        .where(eq(systemRequests.tenantId, ctx.tenantId));
      return rows.flatMap((row) => {
        const key = z.enum(MODULE_KEYS).safeParse(row.moduleKey);
        if (!key.success || key.data === 'platform') return [];
        return [{ id: row.id, moduleKey: key.data, createdAt: row.createdAt }];
      });
    },
    opts
  );
}

export async function listSystemRequestQueue(
  ctx: StaffContext,
  opts: Options = {}
): Promise<SystemRequestQueueRow[]> {
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select * from admin_list_system_requests()`),
    opts
  );
  return (rows as unknown as Record<string, unknown>[]).flatMap((row) => {
    const key = z.enum(MODULE_KEYS).safeParse(row.module_key);
    if (!key.success || key.data === 'platform') return [];
    return [
      {
        id: String(row.id),
        tenantId: String(row.tenant_id),
        tenantName: String(row.tenant_name),
        moduleKey: key.data,
        createdAt: new Date(row.created_at as string | Date).toISOString()
      }
    ];
  });
}
