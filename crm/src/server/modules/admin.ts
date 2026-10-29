import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { tenantModules, tenants } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { withPlatform, withTenant } from '../tenancy';
import { MODULE_KEYS, type CrmLevel, type ModuleKey } from './keys';

/** Who is acting. Only `admin` may read or change flags (SECURITY 2.2: module flags, admin only). */
export type ModuleActor = { id: string; kyneticRole: 'admin' | 'va' | null };

export type TenantModuleState = {
  moduleKey: ModuleKey;
  enabled: boolean;
  /** `crm` only; kept while the module is off so a later switch-on can offer the same level. */
  level: CrmLevel | null;
  changedAt: string | null;
  changedBy: string | null;
};

export type ModuleHistoryEntry = {
  at: Date;
  actorUserId: string | null;
  moduleKey: string;
  before: { enabled: boolean; level: CrmLevel | null } | null;
  after: { enabled: boolean; level: CrmLevel | null };
};

function requireAdmin(actor: ModuleActor): asserts actor is ModuleActor & { kyneticRole: 'admin' } {
  if (actor.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
}

const toLevel = (v: unknown): CrmLevel | null => (v === 'lite' || v === 'full' ? v : null);

const setInputSchema = z.object({
  tenantId: z.uuid(),
  moduleKey: z.enum(MODULE_KEYS),
  enabled: z.boolean(),
  level: z.enum(['lite', 'full']).optional()
});
export type SetTenantModuleInput = z.input<typeof setInputSchema>;

const FOLLOWUP_BUNDLE_MODULES = [
  'followup_bundle',
  'quote_followup',
  'reactivation',
  'missed_call_textback'
] as const;

/** A tenant's name and the state of every module, including the ones with no row yet. */
export async function getTenantModules(
  actor: ModuleActor,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<{ tenant: { id: string; name: string }; modules: TenantModuleState[] }> {
  requireAdmin(actor);
  const parsed = z.uuid().safeParse(tenantId);
  if (!parsed.success) throw new AppError('NOT_FOUND');
  // Read-only tenant context: the flags and the tenant row only, no client data.
  const { tenant, rows } = await withTenant(
    { tenantId, userId: actor.id, role: 'admin', readOnly: true },
    async (tx) => ({
      tenant: (
        await tx
          .select({ id: tenants.id, name: tenants.name })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
      )[0],
      rows: await tx.select().from(tenantModules)
    }),
    opts
  );
  if (!tenant) throw new AppError('NOT_FOUND');
  const byKey = new Map(rows.map((r) => [r.moduleKey, r]));
  return {
    tenant,
    modules: MODULE_KEYS.map((moduleKey) => {
      const r = byKey.get(moduleKey);
      return {
        moduleKey,
        enabled: moduleKey === 'platform' ? true : (r?.enabled ?? false),
        level: toLevel(r?.level),
        changedAt: r?.changedAt ?? null,
        changedBy: r?.changedBy ?? null
      };
    })
  };
}

/**
 * Switches one module on or off for one tenant (F-70), or sets the `crm` level (F-85). The write is
 * `set_tenant_module()`, which re-checks the admin role and writes the `module.toggle` audit row in the
 * same transaction. Flags are read from the database on every request, so the change applies on the
 * next one. Data is never touched. Returns `changed: false` when the request matches the current state.
 */
export async function setTenantModule(
  actor: ModuleActor,
  input: SetTenantModuleInput,
  opts: { db?: Db } = {}
): Promise<{ changed: boolean }> {
  requireAdmin(actor);
  const parsed = setInputSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ module: ['invalid'] });
  const { tenantId, moduleKey, enabled } = parsed.data;

  if (moduleKey === 'platform') throw new ValidationError({ module: ['platform_always_on'] });
  if (moduleKey === 'crm' && enabled && !parsed.data.level)
    throw new ValidationError({ level: ['required'] });
  if (moduleKey !== 'crm' && parsed.data.level) throw new ValidationError({ level: ['crm_only'] });

  const { modules } = await getTenantModules(actor, tenantId, opts);
  const current = modules.find((m) => m.moduleKey === moduleKey)!;
  // `crm` always carries a level in the table. Switching it off keeps the last one (or Lite).
  const level: CrmLevel | '' =
    moduleKey === 'crm' ? (enabled ? parsed.data.level! : (current.level ?? 'lite')) : '';

  if (current.enabled === enabled && (moduleKey !== 'crm' || current.level === level))
    return { changed: false };

  try {
    await withPlatform(
      { userId: actor.id, role: 'admin' },
      (tx) =>
        tx.execute(
          sql`select set_tenant_module(${tenantId}::uuid, ${moduleKey}, ${enabled}, ${level})`
        ),
      opts
    );
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === 'P0002')
      throw new AppError('NOT_FOUND');
    throw e;
  }
  return { changed: true };
}

/** Atomically switches the follow-up bundle and all of its member modules. */
export async function setFollowupBundle(
  actor: ModuleActor,
  input: { tenantId: string; enabled: boolean },
  opts: { db?: Db } = {}
): Promise<{ changed: boolean }> {
  requireAdmin(actor);
  const parsed = z.object({ tenantId: z.uuid(), enabled: z.boolean() }).safeParse(input);
  if (!parsed.success) throw new ValidationError({ module: ['invalid'] });
  const { tenantId, enabled } = parsed.data;
  const current = await getTenantModules(actor, tenantId, opts);
  const changed = FOLLOWUP_BUNDLE_MODULES.some(
    (key) => current.modules.find((m) => m.moduleKey === key)?.enabled !== enabled
  );
  if (!changed) return { changed: false };
  try {
    await withPlatform(
      { userId: actor.id, role: 'admin' },
      async (tx) => {
        for (const moduleKey of FOLLOWUP_BUNDLE_MODULES) {
          await tx.execute(
            sql`select set_tenant_module(${tenantId}::uuid, ${moduleKey}, ${enabled}, '')`
          );
        }
      },
      opts
    );
  } catch (e) {
    if ((e as { cause?: { code?: string } }).cause?.code === 'P0002')
      throw new AppError('NOT_FOUND');
    throw e;
  }
  return { changed: true };
}

/** Newest first. Reads `module.toggle` rows through `audit_search()`; the app role cannot read the table. */
export async function listModuleHistory(
  actor: ModuleActor,
  tenantId: string,
  opts: { db?: Db; limit?: number } = {}
): Promise<ModuleHistoryEntry[]> {
  requireAdmin(actor);
  const rows = await withPlatform(
    { userId: actor.id, role: 'admin' },
    async (tx) =>
      (await tx.execute(
        sql`select created_at, actor_user_id, entity_id, before, after
            from audit_search(${tenantId}::uuid, null, 'module.toggle', null, null, ${opts.limit ?? 50})`
      )) as unknown as {
        created_at: Date;
        actor_user_id: string | null;
        entity_id: string | null;
        before: { enabled?: boolean; level?: string } | null;
        after: { enabled?: boolean; level?: string } | null;
      }[],
    opts
  );
  return rows.map((r) => ({
    at: new Date(r.created_at),
    actorUserId: r.actor_user_id,
    moduleKey: r.entity_id ?? '',
    before: r.before
      ? { enabled: Boolean(r.before.enabled), level: toLevel(r.before.level) }
      : null,
    after: { enabled: Boolean(r.after?.enabled), level: toLevel(r.after?.level) }
  }));
}
