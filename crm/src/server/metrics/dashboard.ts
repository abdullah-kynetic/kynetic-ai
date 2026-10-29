import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client';
import { activities, contacts, metricsDaily, tenants, users } from '../db/schema';
import { withTenant, type TenantContextInput } from '../tenancy';

export type DashboardMetrics = {
  totals: {
    leads: number;
    calls: number;
    contactsReached: number;
    estimatesBooked: number;
    revenueCents: number;
  };
  days: (typeof metricsDaily.$inferSelect)[];
  activity: { id: string; summary: string; type: string; occurredAt: string }[];
  sources: { source: string; leads: number }[];
};

export function guaranteeProgress(input: {
  target: number | null;
  startDate: string | null;
  booked: number;
  today?: Date;
}) {
  if (!input.target || !input.startDate) return null;
  const start = new Date(`${input.startDate}T00:00:00Z`);
  const today = input.today ?? new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 60);
  return {
    target: input.target,
    booked: input.booked,
    percent: Math.min(100, Math.round((input.booked / input.target) * 100)),
    daysLeft: Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000))
  };
}

export async function getDashboardMetrics(
  ctx: TenantContextInput,
  from: string,
  to: string,
  opts: { db?: Db; tx?: Tx } = {}
): Promise<DashboardMetrics> {
  const run = async (tx: Tx) => {
    const days = await tx
      .select()
      .from(metricsDaily)
      .where(and(gte(metricsDaily.day, from), lte(metricsDaily.day, to)))
      .orderBy(asc(metricsDaily.day));
    const [totals] = await tx
      .select({
        leads: sql<number>`coalesce(sum(${metricsDaily.leads}),0)::int`,
        calls: sql<number>`coalesce(sum(${metricsDaily.calls}),0)::int`,
        contactsReached: sql<number>`coalesce(sum(${metricsDaily.contactsReached}),0)::int`,
        estimatesBooked: sql<number>`coalesce(sum(${metricsDaily.estimatesBooked}),0)::int`,
        revenueCents: sql<number>`coalesce(sum(${metricsDaily.wonRevenueCents}),0)::int`
      })
      .from(metricsDaily)
      .where(and(gte(metricsDaily.day, from), lte(metricsDaily.day, to)));
    const activity = await tx
      .select({
        id: activities.id,
        summary: activities.summary,
        type: activities.type,
        occurredAt: activities.occurredAt
      })
      .from(activities)
      .leftJoin(users, eq(users.id, activities.actorId))
      .orderBy(sql`${activities.occurredAt} desc`)
      .limit(8);
    const sources = await tx
      .select({
        source: sql<string>`coalesce(${contacts.source}, 'unknown')`,
        leads: sql<number>`count(*)::int`
      })
      .from(contacts)
      .where(
        and(
          gte(contacts.createdAt, `${from}T00:00:00Z`),
          lte(contacts.createdAt, `${to}T23:59:59.999Z`)
        )
      )
      .groupBy(sql`coalesce(${contacts.source}, 'unknown')`)
      .orderBy(sql`count(*) desc`);
    return { totals, days, activity, sources };
  };
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}

export async function getGuaranteeSettings(
  ctx: TenantContextInput,
  opts: { db?: Db; tx?: Tx } = {}
) {
  const run = async (tx: Tx) => {
    const [row] = await tx
      .select({ target: tenants.guaranteeTargetBookings, startDate: tenants.guaranteeStartDate })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`));
    return row ?? { target: null, startDate: null };
  };
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}
