import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from '../db/client';
import { tenantBilling, tenantBillingModules, tenantModules, tenants } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { MODULE_KEYS, type ModuleKey } from '../modules/keys';
import { withPlatform, withTenant } from '../tenancy';

/** Who is acting. Only `admin` may read or change billing (SECURITY F-99: VA, owner and staff get 403). */
export type BillingActor = { id: string; kyneticRole: 'admin' | 'va' | null };

export type PricingTier = 'T1' | 'T2' | 'T3';
export type Plan = 'founding' | 'value';

export type BillingModuleLine = {
  moduleKey: ModuleKey;
  level: string;
  setupCents: number;
  monthlyCents: number;
  discountPct: number;
  snapshotAt: string;
};

export type TenantBillingView = {
  tenant: { id: string; name: string; plan: Plan; pricingTier: PricingTier | null };
  profile: {
    billingStartDate: string | null;
    stripeCustomerId: string | null;
    notes: string | null;
  };
  /** Live snapshots, one per priced module. */
  lines: BillingModuleLine[];
  /** Enabled modules with no live snapshot, because the tier was not set when they were switched on. */
  unpriced: ModuleKey[];
  /** After each line's discount, whole cents. Feeds MRR on the all-clients table (F-53). */
  totals: { setupCents: number; monthlyCents: number };
  /** Reference text only: the fixed founding terms are not computed from the snapshots. */
  foundingReference: string | null;
};

export const FOUNDING_REFERENCE =
  '$6,500 setup covering the first 3 months, then $1,500 per month.';

function requireAdmin(
  actor: BillingActor
): asserts actor is BillingActor & { kyneticRole: 'admin' } {
  if (actor.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
}

const discounted = (cents: number, pct: number) => Math.round((cents * (100 - pct)) / 100);

/** Sums the live lines after discount. Exported so the all-clients table (M8b) uses the same rule. */
export function billingTotals(
  lines: Pick<BillingModuleLine, 'setupCents' | 'monthlyCents' | 'discountPct'>[]
) {
  return lines.reduce(
    (t, l) => ({
      setupCents: t.setupCents + discounted(l.setupCents, l.discountPct),
      monthlyCents: t.monthlyCents + discounted(l.monthlyCents, l.discountPct)
    }),
    { setupCents: 0, monthlyCents: 0 }
  );
}

const tenantIdSchema = z.uuid();

/** The billing tab's data. Reads run as an admin in a read-only tenant context; RLS admits only that role. */
export async function getTenantBilling(
  actor: BillingActor,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<TenantBillingView> {
  requireAdmin(actor);
  if (!tenantIdSchema.safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  const { tenant, profile, snapshots, enabled } = await withTenant(
    { tenantId, userId: actor.id, role: 'admin', readOnly: true },
    async (tx) => ({
      tenant: (
        await tx
          .select({
            id: tenants.id,
            name: tenants.name,
            plan: tenants.plan,
            pricingTier: tenants.pricingTier
          })
          .from(tenants)
          .where(eq(tenants.id, tenantId))
      )[0],
      profile: (
        await tx.select().from(tenantBilling).where(eq(tenantBilling.tenantId, tenantId))
      )[0],
      snapshots: await tx
        .select()
        .from(tenantBillingModules)
        .where(
          and(eq(tenantBillingModules.tenantId, tenantId), isNull(tenantBillingModules.endedAt))
        )
        .orderBy(desc(tenantBillingModules.snapshotAt)),
      enabled: await tx
        .select({ moduleKey: tenantModules.moduleKey })
        .from(tenantModules)
        .where(eq(tenantModules.enabled, true))
    }),
    opts
  );
  if (!tenant) throw new AppError('NOT_FOUND');

  const order = new Map(MODULE_KEYS.map((k, i) => [k as string, i]));
  const lines = snapshots
    .map((s) => ({
      moduleKey: s.moduleKey as ModuleKey,
      level: s.level,
      setupCents: s.setupCents,
      monthlyCents: s.monthlyCents,
      discountPct: s.discountPct,
      snapshotAt: s.snapshotAt
    }))
    .sort((a, b) => (order.get(a.moduleKey) ?? 0) - (order.get(b.moduleKey) ?? 0));
  const priced = new Set<string>(lines.map((l) => l.moduleKey));
  return {
    tenant: {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan as Plan,
      pricingTier: (tenant.pricingTier as PricingTier | null) ?? null
    },
    profile: {
      billingStartDate: profile?.billingStartDate ?? null,
      stripeCustomerId: profile?.stripeCustomerId ?? null,
      notes: profile?.notes ?? null
    },
    lines,
    unpriced: enabled
      .map((e) => e.moduleKey as ModuleKey)
      .filter((k) => k !== 'platform' && !priced.has(k)),
    totals: billingTotals(lines),
    foundingReference: tenant.plan === 'founding' ? FOUNDING_REFERENCE : null
  };
}

const planTierSchema = z
  .object({
    tenantId: z.uuid(),
    plan: z.enum(['founding', 'value']).optional(),
    pricingTier: z.enum(['T1', 'T2', 'T3']).nullable().optional()
  })
  .refine((v) => v.plan !== undefined || v.pricingTier !== undefined);
export type SetPlanTierInput = z.input<typeof planTierSchema>;

/**
 * Records the plan and value tier (F-86) through `admin_update_tenant_commercial()`, which re-checks
 * the admin role and audits before and after. Existing price snapshots are not touched: a new tier
 * applies to modules switched on, or re-snapshotted, afterwards.
 */
export async function setTenantPlanTier(
  actor: BillingActor,
  input: SetPlanTierInput,
  opts: { db?: Db } = {}
): Promise<void> {
  requireAdmin(actor);
  const parsed = planTierSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ planTier: ['invalid'] });
  const { tenantId, plan, pricingTier } = parsed.data;
  const patch: Record<string, string | null> = {};
  if (plan !== undefined) patch.plan = plan;
  if (pricingTier !== undefined) patch.pricing_tier = pricingTier;
  await callAdminFunction(opts, actor, (tx) =>
    tx.execute(
      sql`select admin_update_tenant_commercial(${tenantId}::uuid, ${JSON.stringify(patch)}::jsonb)`
    )
  );
}

const profileSchema = z.object({
  tenantId: z.uuid(),
  billingStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  stripeCustomerId: z.string().trim().max(100).nullable().optional(),
  notes: z.string().max(4000).nullable().optional()
});
export type UpdateBillingProfileInput = z.input<typeof profileSchema>;

/** Saves the profile fields the admin sent; the rest are kept. Empty strings clear a field. Audited. */
export async function updateBillingProfile(
  actor: BillingActor,
  input: UpdateBillingProfileInput,
  opts: { db?: Db } = {}
): Promise<void> {
  requireAdmin(actor);
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string[]> = {};
    for (const issue of parsed.error.issues) fields[String(issue.path[0] ?? 'form')] = ['invalid'];
    throw new ValidationError(fields);
  }
  const { tenantId, billingStartDate, stripeCustomerId, notes } = parsed.data;
  const blank = (v: string | null | undefined) => (v === undefined ? undefined : v?.trim() || null);
  const patch: Record<string, string | null> = {};
  if (billingStartDate !== undefined) patch.billing_start_date = blank(billingStartDate) ?? null;
  if (stripeCustomerId !== undefined) patch.stripe_customer_id = blank(stripeCustomerId) ?? null;
  if (notes !== undefined) patch.notes = blank(notes) ?? null;
  await callAdminFunction(opts, actor, (tx) =>
    tx.execute(
      sql`select admin_set_tenant_billing(${tenantId}::uuid, ${JSON.stringify(patch)}::jsonb)`
    )
  );
}

const snapshotSchema = z.object({
  tenantId: z.uuid(),
  moduleKey: z.enum(MODULE_KEYS),
  discountPct: z.number().int().min(0).max(100).optional()
});
export type SnapshotModuleInput = z.input<typeof snapshotSchema>;

/**
 * Takes a fresh snapshot of one enabled module at today's catalogue price for the tenant's tier, with an
 * optional manual discount (percent). Needed when the tier was unset at enable time. The earlier
 * snapshot is ended, not edited, so history stays.
 */
export async function snapshotModulePrice(
  actor: BillingActor,
  input: SnapshotModuleInput,
  opts: { db?: Db } = {}
): Promise<void> {
  requireAdmin(actor);
  const parsed = snapshotSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ discountPct: ['invalid'] });
  const { tenantId, moduleKey, discountPct } = parsed.data;
  await callAdminFunction(opts, actor, (tx) =>
    tx.execute(
      sql`select admin_snapshot_module_price(${tenantId}::uuid, ${moduleKey}, ${discountPct ?? null}::int)`
    )
  );
}

/** Runs one admin SQL function and maps its error codes (P0002 not found, 22023 refused input) to app errors. */
async function callAdminFunction(
  opts: { db?: Db },
  actor: BillingActor,
  run: (tx: Tx) => Promise<unknown>
) {
  try {
    await withPlatform({ userId: actor.id, role: 'admin' }, run, opts);
  } catch (e) {
    const code = (e as { cause?: { code?: string; message?: string } }).cause?.code;
    if (code === 'P0002') throw new AppError('NOT_FOUND');
    if (code === '22023') throw new ValidationError({ billing: ['not_allowed'] });
    throw e;
  }
}
