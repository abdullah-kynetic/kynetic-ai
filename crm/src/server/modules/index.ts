import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { tenantModules } from '../db/schema';
import { withTenant } from '../tenancy';
import type { TenantContextInput } from '../tenancy';
import {
  moduleSatisfied,
  MODULE_KEYS,
  type CrmLevel,
  type EnabledModules,
  type ModuleKey,
  type ModuleNeed
} from './keys';

export {
  MODULE_KEYS,
  moduleSatisfied,
  type CrmLevel,
  type EnabledModules,
  type ModuleKey,
  type ModuleNeed
};

export class ModuleDisabledError extends Error {
  readonly code = 'MODULE_DISABLED';
  readonly status = 403;
  constructor(
    readonly moduleKey: ModuleKey,
    readonly level?: CrmLevel
  ) {
    super(`The ${moduleKey}${level ? ` (${level})` : ''} module is not enabled for this account.`);
    this.name = 'ModuleDisabledError';
  }
}

/**
 * The flags for the tenant in `ctx`, read from the database on every call (SECURITY 2.4: not from the
 * client or a token claim). No cache yet: the rule allows at most 30 s with invalidation on write, and
 * one indexed read per request is cheaper than getting invalidation wrong.
 */
export async function loadEnabledModules(
  ctx: TenantContextInput,
  opts: { db?: Db } = {}
): Promise<EnabledModules> {
  const rows = await withTenant(
    ctx,
    (tx) =>
      tx
        .select({ key: tenantModules.moduleKey, level: tenantModules.level })
        .from(tenantModules)
        .where(eq(tenantModules.enabled, true)),
    opts
  );
  const keys = new Set<ModuleKey>(['platform']);
  let crmLevel: CrmLevel | null = null;
  for (const r of rows) {
    if (!(MODULE_KEYS as readonly string[]).includes(r.key)) continue;
    keys.add(r.key as ModuleKey);
    if (r.key === 'crm' && (r.level === 'lite' || r.level === 'full')) crmLevel = r.level;
  }
  return { keys, crmLevel };
}

export async function isModuleEnabled(
  ctx: TenantContextInput,
  key: ModuleKey,
  opts: { level?: CrmLevel; db?: Db } = {}
): Promise<boolean> {
  if (key === 'platform') return true;
  return moduleSatisfied(await loadEnabledModules(ctx, opts), { module: key, level: opts.level });
}

export async function listEnabledModules(
  ctx: TenantContextInput,
  opts: { db?: Db } = {}
): Promise<ModuleKey[]> {
  const enabled = await loadEnabledModules(ctx, opts);
  return MODULE_KEYS.filter((k) => moduleSatisfied(enabled, { module: k }));
}

/**
 * First line of every module route, server action, job handler and webhook processor (F-70). Throws
 * ModuleDisabledError, which routes turn into 403 MODULE_DISABLED and jobs into a logged cancel.
 * For `crm`, pass `level: 'full'` on Full-only surfaces; a `lite` tenant is refused there.
 */
export async function requireModule(
  ctx: TenantContextInput,
  key: ModuleKey,
  opts: { level?: CrmLevel; db?: Db } = {}
): Promise<void> {
  if (!(await isModuleEnabled(ctx, key, opts))) throw new ModuleDisabledError(key, opts.level);
}

/** The 403 body routes return when a module is off. Nothing was written. */
export function moduleDisabledResponse(err: ModuleDisabledError): Response {
  return Response.json(
    { ok: false, error: { code: err.code, message: err.message } },
    { status: err.status }
  );
}
