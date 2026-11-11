import { and, asc, eq, gte, lt, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from '../db/client';
import { tenants, usageDaily } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { calendarDateInTimeZone } from '../metrics';
import { requireModule } from '../modules';
import { capStatus, type CapStatus } from '../usage';
import { withTenant, type TenantContextInput } from '../tenancy';

/**
 * Client usage page (SPEC 01). Owner only and quantity-only: no provider cost, margin or fee ever
 * leaves this module (P-A2). `usage_daily` already carries a per-tenant RLS select policy, so no
 * SECURITY DEFINER wrapper is needed; the service simply never selects the cost columns.
 */

export const USAGE_MONTH_PATTERN = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type ClientUsageDay = {
  day: string;
  calls: number;
  sms: number;
  emails: number;
  minutes: number;
};

export type ClientUsageCap = { status: CapStatus; label: string };

export type ClientUsage = {
  month: string;
  totals: { minutes: number; calls: number; sms: number; emails: number };
  daily: ClientUsageDay[];
  cap: ClientUsageCap;
};

export type ClientUsageOpts = { db?: Db; tx?: Tx; now?: Date };

/** What the spec calls the cap states. Provider wording stays internal. */
export const CLIENT_CAP_LABELS: Record<CapStatus, string> = {
  no_cap: 'No cap',
  under: 'Under limit',
  watch: 'Near limit',
  reached: 'Limit reached'
};

/** Owner of the account, or a Kynetic admin. Staff and VA never see usage (SPEC 01). */
export function canViewClientUsage(role: string): boolean {
  return role === 'owner' || role === 'admin';
}

const monthStart = (month: string) => `${month}-01`;
const monthAfter = (month: string) => {
  const d = new Date(`${monthStart(month)}T00:00:00.000Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};

export function resolveUsageMonth(raw: string | undefined, today: string): string {
  if (raw === undefined || raw === '') return today.slice(0, 7);
  if (!USAGE_MONTH_PATTERN.test(raw)) throw new ValidationError({ month: ['invalid_date'] });
  return raw;
}

export async function getClientUsage(
  ctx: TenantContextInput,
  month: string,
  opts: ClientUsageOpts = {}
): Promise<ClientUsage> {
  if (!canViewClientUsage(ctx.role)) throw new AppError('FORBIDDEN');
  if (!USAGE_MONTH_PATTERN.test(month)) throw new ValidationError({ month: ['invalid_date'] });
  const read = async (tx: Tx): Promise<ClientUsage> => {
    await requireModule(ctx, 'platform', { tx });
    const start = monthStart(month);
    const end = monthAfter(month);
    const rows = await tx
      .select({
        day: usageDaily.day,
        callCount: usageDaily.callCount,
        callSeconds: usageDaily.callSeconds,
        smsCount: usageDaily.smsCount,
        emailCount: usageDaily.emailCount
      })
      .from(usageDaily)
      .where(and(gte(usageDaily.day, start), lt(usageDaily.day, end)))
      .orderBy(asc(usageDaily.day));
    // Cap status needs provider cost, but only the resulting status is returned.
    const [costs] = await tx
      .select({
        callCostCents: sql<number>`coalesce(sum(${usageDaily.callCostCents}), 0)::int`,
        messageCostCents: sql<number>`coalesce(sum(${usageDaily.messageCostCents}), 0)::int`
      })
      .from(usageDaily)
      .where(and(gte(usageDaily.day, start), lt(usageDaily.day, end)));
    const [tenant] = await tx
      .select({ capCents: tenants.monthlySpendCapCents })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`));

    const daily = rows.map((r) => ({
      day: String(r.day).slice(0, 10),
      calls: Number(r.callCount),
      sms: Number(r.smsCount),
      emails: Number(r.emailCount),
      minutes: Math.round((Number(r.callSeconds) / 60) * 10) / 10
    }));
    const totals = daily.reduce(
      (sum, d) => ({
        minutes: Math.round((sum.minutes + d.minutes) * 10) / 10,
        calls: sum.calls + d.calls,
        sms: sum.sms + d.sms,
        emails: sum.emails + d.emails
      }),
      { minutes: 0, calls: 0, sms: 0, emails: 0 }
    );
    const status = capStatus({
      tenantId: ctx.tenantId,
      tenantName: '',
      callCount: totals.calls,
      callSeconds: Math.round(totals.minutes * 60),
      callCostCents: Number(costs?.callCostCents ?? 0),
      smsCount: totals.sms,
      emailCount: totals.emails,
      messageCostCents: Number(costs?.messageCostCents ?? 0),
      costUnknown: false,
      monthlyFeeCents: null,
      capCents: tenant?.capCents ?? null
    });
    return { month, totals, daily, cap: { status, label: CLIENT_CAP_LABELS[status] } };
  };
  return opts.tx ? read(opts.tx) : withTenant(ctx, read, { db: opts.db });
}

/** The month to show when the URL has none, in the tenant's time zone. */
export function currentUsageMonth(now: Date, timeZone: string): string {
  return calendarDateInTimeZone(now, timeZone).slice(0, 7);
}

export const usageMonthSchema = z.string().regex(USAGE_MONTH_PATTERN);

/** The current month in the tenant's time zone. Reads the clock here so pages stay pure. */
export function usageMonthNow(timeZone: string): string {
  return currentUsageMonth(new Date(), timeZone);
}
