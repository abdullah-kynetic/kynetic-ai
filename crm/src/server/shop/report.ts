import { and, eq, gte, isNull, sql } from 'drizzle-orm';
import { calls, deals, pipelineStages, tenants } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import { getMoney, weekStart } from './money';

const DAY_MS = 86_400_000;
export const REPORT_WEEKS = 8;

export type WeekStats = {
  /** Monday 00:00 in the shop's time zone, as an ISO instant. */
  weekStart: string;
  carsDone: number;
  moneyInCents: number;
  /** Money in divided by cars done; null in a week with no cars done. */
  avgTicketCents: number | null;
  insurance: { cars: number; cents: number };
  outOfPocket: { cars: number; cents: number };
  /** Cars done whose payment type was never filled in. */
  unspecifiedCars: number;
  callsAnswered: number;
  /** Jobs created this week that have reached the Quoted stage or later (and were not lost). */
  quotesSent: number;
};

export type WeeklyReport = {
  /** Oldest first; the last entry is the current week. */
  weeks: WeekStats[];
  current: WeekStats;
  timeZone: string;
};

/** The weekly report, from won deals, calls and deals. Every number is a count or sum of real rows. */
export async function getWeeklyReport(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<WeeklyReport> {
  const now = opts.now ?? new Date();
  const money = await getMoney(ctx, opts);
  return shopRun(ctx, opts, async (tx) => {
    const [tenant] = await tx
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .limit(1);
    const zone = tenant?.timezone ?? 'America/Chicago';
    const current = weekStart(now, zone).getTime();
    // Noon on each earlier Monday avoids daylight-saving edges when stepping back by weeks.
    const starts = Array.from({ length: REPORT_WEEKS }, (_, i) =>
      i === 0
        ? current
        : weekStart(new Date(current - i * 7 * DAY_MS + 12 * 3_600_000), zone).getTime()
    ).reverse();
    const first = starts[0]!;
    const bucket = (t: number) => {
      for (let i = starts.length - 1; i >= 0; i--) if (t >= starts[i]!) return i;
      return -1;
    };
    const weeks: WeekStats[] = starts.map((s) => ({
      weekStart: new Date(s).toISOString(),
      carsDone: 0,
      moneyInCents: 0,
      avgTicketCents: null,
      insurance: { cars: 0, cents: 0 },
      outOfPocket: { cars: 0, cents: 0 },
      unspecifiedCars: 0,
      callsAnswered: 0,
      quotesSent: 0
    }));
    for (const m of money.moneyIn) {
      const i = bucket(new Date(m.wonAt).getTime());
      if (i < 0 || new Date(m.wonAt).getTime() >= current + 7 * DAY_MS) continue;
      const w = weeks[i]!;
      w.carsDone += 1;
      w.moneyInCents += m.amountCents;
      if (m.paymentType === 'insurance') {
        w.insurance.cars += 1;
        w.insurance.cents += m.amountCents;
      } else if (m.paymentType === 'out_of_pocket') {
        w.outOfPocket.cars += 1;
        w.outOfPocket.cents += m.amountCents;
      } else w.unspecifiedCars += 1;
    }
    const callRows = await tx
      .select({ startedAt: calls.startedAt })
      .from(calls)
      .where(
        and(
          eq(calls.direction, 'inbound'),
          gte(calls.startedAt, new Date(first).toISOString()),
          sql`${calls.outcome} is not null and ${calls.outcome} <> 'no_answer'`
        )
      );
    for (const c of callRows) {
      const i = bucket(new Date(c.startedAt).getTime());
      if (i >= 0) weeks[i]!.callsAnswered += 1;
    }
    const quoted = await tx
      .select({ createdAt: deals.createdAt })
      .from(deals)
      .innerJoin(pipelineStages, eq(pipelineStages.id, deals.stageId))
      .where(
        and(
          isNull(deals.deletedAt),
          gte(deals.createdAt, new Date(first).toISOString()),
          eq(pipelineStages.isLost, false),
          sql`${pipelineStages.position} >= (
            select q.position from pipeline_stages q
            where q.pipeline_id = ${deals.pipelineId} and q.name = 'Quoted' limit 1)`
        )
      );
    for (const d of quoted) {
      const i = bucket(new Date(d.createdAt).getTime());
      if (i >= 0) weeks[i]!.quotesSent += 1;
    }
    for (const w of weeks)
      w.avgTicketCents = w.carsDone > 0 ? Math.round(w.moneyInCents / w.carsDone) : null;
    return { weeks, current: weeks[weeks.length - 1]!, timeZone: zone };
  });
}
