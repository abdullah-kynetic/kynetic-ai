import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { withPlatform } from '../tenancy';
import type { PlatformContext } from '../tenancy';
import type { Db } from '../db/client';

export const AUDIT_PAGE_SIZE = 50;

const blankToUndefined = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);

/** Filters as they arrive in the URL (F-60). Blank fields mean "no filter". */
export const auditFiltersSchema = z.object({
  tenant: z.preprocess(blankToUndefined, z.uuid().optional()),
  actor: z.preprocess(blankToUndefined, z.uuid().optional()),
  action: z.preprocess(blankToUndefined, z.string().trim().max(120).optional()),
  from: z.preprocess(blankToUndefined, z.iso.date().optional()),
  to: z.preprocess(blankToUndefined, z.iso.date().optional()),
  page: z.preprocess(blankToUndefined, z.coerce.number().int().min(1).max(20).default(1))
});
export type AuditFilters = z.output<typeof auditFiltersSchema>;

export type AuditRow = {
  id: string;
  tenantId: string | null;
  actorUserId: string | null;
  impersonatorUserId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
};

export type AuditPage = { rows: AuditRow[]; page: number; hasNext: boolean };

type Raw = Record<string, unknown>;

function toRow(r: Raw): AuditRow {
  return {
    id: String(r.id),
    tenantId: (r.tenant_id as string | null) ?? null,
    actorUserId: (r.actor_user_id as string | null) ?? null,
    impersonatorUserId: (r.impersonator_user_id as string | null) ?? null,
    action: String(r.action),
    entity: String(r.entity),
    entityId: (r.entity_id as string | null) ?? null,
    before: r.before ?? null,
    after: r.after ?? null,
    ip: (r.ip as string | null) ?? null,
    userAgent: (r.user_agent as string | null) ?? null,
    createdAt: new Date(r.created_at as string | Date)
  };
}

/**
 * Reads the audit log for the admin viewer (F-60). Goes through `audit_search`, the SECURITY DEFINER
 * function that allows admin and VA and refuses everyone else (SECURITY 2.2, DATABASE roll-ups), so
 * the web role never reads `audit_log` directly. The role is checked again here so a client role
 * fails before any query runs. Reading is not itself written to the log. Pages are fetched with one
 * extra row to know whether a next page exists; the function caps the window at 1,000 rows.
 */
export async function searchAuditLog(
  ctx: PlatformContext,
  rawFilters: z.input<typeof auditFiltersSchema>,
  opts: { db?: Db } = {}
): Promise<AuditPage> {
  if (ctx.role !== 'admin' && ctx.role !== 'va') throw new Error('Audit log is staff only');
  const f = auditFiltersSchema.parse(rawFilters);
  const from = f.from ? `${f.from}T00:00:00Z` : null;
  // The upper bound is exclusive, so "to" includes the whole chosen day.
  const to = f.to ? new Date(Date.parse(`${f.to}T00:00:00Z`) + 86_400_000).toISOString() : null;
  const offset = (f.page - 1) * AUDIT_PAGE_SIZE;
  const limit = offset + AUDIT_PAGE_SIZE + 1;

  const raw = await withPlatform(
    ctx,
    async (tx) =>
      Array.from(
        (await tx.execute(
          sql`select * from audit_search(${f.tenant ?? null}::uuid, ${f.actor ?? null}::uuid,
            ${f.action ?? null}::text, ${from}::timestamptz, ${to}::timestamptz, ${limit}::integer)`
        )) as unknown as Raw[]
      ),
    opts
  );
  const window = raw.slice(offset);
  return {
    rows: window.slice(0, AUDIT_PAGE_SIZE).map(toRow),
    page: f.page,
    hasNext: window.length > AUDIT_PAGE_SIZE
  };
}

export type TenantOption = { id: string; name: string };

/** Tenant names for the filter. Reads the non-PII overview roll-up, which also allows admin and VA. */
export async function listTenantOptions(
  ctx: PlatformContext,
  opts: { db?: Db } = {}
): Promise<TenantOption[]> {
  const raw = await withPlatform(
    ctx,
    async (tx) =>
      Array.from(
        (await tx.execute(
          sql`select tenant_id, name from admin_tenant_overview()`
        )) as unknown as Raw[]
      ),
    opts
  );
  return raw.map((r) => ({ id: String(r.tenant_id), name: String(r.name) }));
}
