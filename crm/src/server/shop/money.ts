import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { contacts, dealContacts, deals, pipelineStages, tenants } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import { paymentTypeOf } from './jobs';
import type { MoneyInRow, MoneyOutRow } from './types';

/** The instant whose wall clock in `timeZone` reads `localMs` (given as if it were UTC). */
function zonedInstant(localMs: number, timeZone: string): number {
  let guess = localMs;
  for (let i = 0; i < 2; i++) {
    const shown = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).formatToParts(new Date(guess));
    const g = (t: string) => Number(shown.find((p) => p.type === t)!.value);
    guess += localMs - Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  }
  return guess;
}

function localDate(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    dayIndex: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'))
  };
}

/** Start of the week (Monday 00:00) in the given IANA zone, as a UTC instant. */
export function weekStart(now: Date, timeZone: string): Date {
  const d = localDate(now, timeZone);
  const mondayLocal = Date.UTC(d.year, d.month - 1, d.day) - d.dayIndex * 86_400_000;
  return new Date(zonedInstant(mondayLocal, timeZone));
}

/** Start of the local day in the given IANA zone, as a UTC instant. */
export function dayStart(now: Date, timeZone: string): Date {
  const d = localDate(now, timeZone);
  return new Date(zonedInstant(Date.UTC(d.year, d.month - 1, d.day), timeZone));
}

/** Start of the month (the 1st, 00:00) in the given IANA zone, as a UTC instant. */
export function monthStart(now: Date, timeZone: string): Date {
  const d = localDate(now, timeZone);
  return new Date(zonedInstant(Date.UTC(d.year, d.month - 1, 1), timeZone));
}

export type MoneySummary = {
  moneyIn: MoneyInRow[];
  moneyOut: MoneyOutRow[];
  totals: {
    weekInCents: number;
    monthInCents: number;
    allInCents: number;
    outCents: number;
  };
};

/**
 * Money in is won deals (picked up) by the date they were won. Money out has no table yet, so it is
 * always empty and the totals say zero out, never a made-up figure.
 */
export async function getMoney(
  ctx: TenantContextInput,
  opts: ShopOpts & { timeZone?: string } = {}
): Promise<MoneySummary> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const [tenant] = await tx
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .limit(1);
    const zone = opts.timeZone ?? tenant?.timezone ?? 'America/Chicago';
    const rows = await tx
      .select({
        id: deals.id,
        title: deals.title,
        valueCents: deals.valueCents,
        custom: deals.custom,
        wonAt: deals.wonAt,
        first: contacts.firstName,
        last: contacts.lastName
      })
      .from(deals)
      .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .leftJoin(dealContacts, eq(dealContacts.dealId, deals.id))
      .leftJoin(contacts, eq(contacts.id, dealContacts.contactId))
      .where(
        and(
          eq(pipelineStages.isWon, true),
          isNull(deals.deletedAt),
          sql`${deals.wonAt} is not null`
        )
      )
      .orderBy(desc(deals.wonAt))
      .limit(500);
    const seen = new Set<string>();
    const moneyIn: MoneyInRow[] = [];
    for (const r of rows) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      const custom = (r.custom && typeof r.custom === 'object' ? r.custom : {}) as Record<
        string,
        unknown
      >;
      moneyIn.push({
        id: r.id,
        title: r.title,
        customerName: r.first ? `${r.first} ${r.last ?? ''}`.trim() : null,
        amountCents: r.valueCents,
        paymentType: paymentTypeOf(custom.payment_type),
        wonAt: r.wonAt as string
      });
    }
    const weekFrom = weekStart(now, zone).getTime();
    const monthFrom = monthStart(now, zone).getTime();
    const sum = (from: number) =>
      moneyIn
        .filter((m) => new Date(m.wonAt).getTime() >= from)
        .reduce((n, m) => n + m.amountCents, 0);
    return {
      moneyIn,
      moneyOut: [],
      totals: {
        weekInCents: sum(weekFrom),
        monthInCents: sum(monthFrom),
        allInCents: moneyIn.reduce((n, m) => n + m.amountCents, 0),
        outCents: 0
      }
    };
  });
}
