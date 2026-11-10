import { and, asc, eq, gte, lt, lte, sql } from 'drizzle-orm';
import type { Db, Tx } from '../db/client';
import { activities, appointments, contacts, metricsDaily, tenants, users } from '../db/schema';
import { withTenant, type TenantContextInput } from '../tenancy';
import { bookingRatePercent, measureSpeedToLeadMinutes } from './formulas';

/** The offer in force: 20% more booked appointments than last month, measured over 30 days. */
export const GUARANTEE_WINDOW_DAYS = 30;
export const GUARANTEE_LIFT = 0.2;

export function guaranteeTargetFromBaseline(baseline: number): number {
  return Math.ceil(baseline * (1 + GUARANTEE_LIFT));
}

function shiftUtcDate(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString();
}

export type DashboardMetrics = {
  totals: {
    leads: number;
    calls: number;
    contactsReached: number;
    estimatesBooked: number;
    revenueCents: number;
    /** Whole percent. Null when the range has no leads. */
    bookingRate: number | null;
    /** Median minutes. Null when no lead-intake contact was called in the range. */
    speedToLeadMinutes: number | null;
  };
  days: (typeof metricsDaily.$inferSelect)[];
  activity: { id: string; summary: string; type: string; occurredAt: string }[];
  sources: { source: string; leads: number }[];
};

export function guaranteeProgress(input: {
  baseline: number | null;
  startDate: string | null;
  booked: number;
  today?: Date;
}) {
  if (input.baseline === null || input.baseline < 0 || !input.startDate) return null;
  const start = new Date(`${input.startDate}T00:00:00Z`);
  const today = input.today ?? new Date();
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + GUARANTEE_WINDOW_DAYS);
  const target = guaranteeTargetFromBaseline(input.baseline);
  const percent =
    target === 0
      ? input.booked > 0
        ? 100
        : 0
      : Math.min(100, Math.round((input.booked / target) * 100));
  return {
    baseline: input.baseline,
    target,
    booked: input.booked,
    percent,
    daysLeft: Math.max(0, Math.ceil((end.getTime() - today.getTime()) / 86400000)),
    windowDays: GUARANTEE_WINDOW_DAYS
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
    const leads = Number(totals?.leads ?? 0);
    const estimatesBooked = Number(totals?.estimatesBooked ?? 0);
    const speedToLeadMinutes = await measureSpeedToLeadMinutes(tx, from, to);
    return {
      totals: {
        leads,
        calls: Number(totals?.calls ?? 0),
        contactsReached: Number(totals?.contactsReached ?? 0),
        estimatesBooked,
        revenueCents: Number(totals?.revenueCents ?? 0),
        bookingRate: bookingRatePercent(estimatesBooked, leads),
        speedToLeadMinutes
      },
      days,
      activity,
      sources
    };
  };
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}

export type GuaranteeSettings = {
  /** Admin override of last month's booked appointments. Null uses the measured count. */
  baselineOverride: number | null;
  /** Booked appointments in the 30 days before the start date. Null until a start date is set. */
  measuredBaseline: number | null;
  startDate: string | null;
  /** Booked appointments from the start date through the next 30 days. */
  bookedInWindow: number | null;
};

async function countBooked(tx: Tx, fromIso: string, toIso: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(appointments)
    .where(
      and(
        sql`${appointments.status} <> 'cancelled'`,
        gte(appointments.createdAt, fromIso),
        lt(appointments.createdAt, toIso)
      )
    );
  return Number(row?.n ?? 0);
}

export async function getGuaranteeSettings(
  ctx: TenantContextInput,
  opts: { db?: Db; tx?: Tx } = {}
): Promise<GuaranteeSettings> {
  const run = async (tx: Tx): Promise<GuaranteeSettings> => {
    const [row] = await tx
      .select({
        baselineOverride: tenants.guaranteeBaselineBookings,
        startDate: tenants.guaranteeStartDate
      })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`));
    if (!row?.startDate) {
      return {
        baselineOverride: row?.baselineOverride ?? null,
        measuredBaseline: null,
        startDate: null,
        bookedInWindow: null
      };
    }
    const startIso = `${row.startDate}T00:00:00.000Z`;
    const measuredBaseline = await countBooked(
      tx,
      shiftUtcDate(row.startDate, -GUARANTEE_WINDOW_DAYS),
      startIso
    );
    const bookedInWindow = await countBooked(
      tx,
      startIso,
      shiftUtcDate(row.startDate, GUARANTEE_WINDOW_DAYS)
    );
    return {
      baselineOverride: row.baselineOverride,
      measuredBaseline,
      startDate: row.startDate,
      bookedInWindow
    };
  };
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}
