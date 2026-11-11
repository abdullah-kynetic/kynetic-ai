import { z } from 'zod';
import type { Tx } from '../db/client';
import { requireModule } from '../modules';
import type { TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';
import { getDashboardMetrics, getGuaranteeSettings, guaranteeProgress } from '../metrics';
import { addCalendarDays } from '../metrics/formulas';
import { reportPeriodSchema } from './schema';

const count = z.number().finite().nonnegative();
export const reportContentSchema = z.object({
  periodStart: reportPeriodSchema,
  sections: z.object({
    performance: z.object({
      data: z.object({
        leads: count,
        calls: count,
        booked: count,
        bookingRate: count.nullable(),
        speedToLeadMinutes: count.nullable(),
        reached: count.optional(),
        won: count.optional()
      })
    }),
    revenue: z.object({ data: z.object({ revenueCents: count }) }),
    daily: z
      .object({
        data: z.object({
          days: z.array(z.object({ day: z.iso.date(), leads: count, estimatesBooked: count }))
        })
      })
      .optional(),
    guarantee: z.object({ data: z.object({ result: z.string() }) }).optional()
  })
});

/** One projection shared by generated snapshots and the read-only fallback. No provider or cost data. */
export async function computeReportContent(ctx: TenantContextInput, periodStart: string, tx: Tx) {
  await requireModule(ctx, 'platform', { tx });
  const period = parseInput(reportPeriodSchema, periodStart);
  const end = new Date(`${period}T00:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const to = addCalendarDays(end.toISOString().slice(0, 10), -1);
  const metrics = await getDashboardMetrics(ctx, period, to, { tx });
  const asOf = new Date(Math.min(end.getTime(), Date.now()));
  const settings = await getGuaranteeSettings(ctx, { tx, asOf: asOf.toISOString() });
  const progress = guaranteeProgress({
    baseline: settings.baselineOverride ?? settings.measuredBaseline,
    startDate: settings.startDate,
    booked: settings.bookedInWindow ?? 0,
    today: asOf
  });
  // A report can only evaluate a guarantee that has started by its month end.
  const result =
    !progress || !settings.startDate || settings.startDate > to
      ? 'Not set for this period'
      : progress.booked >= progress.target
        ? 'Target met'
        : progress.daysLeft > 0
          ? 'In progress'
          : 'Below target — work continues free';
  return {
    periodStart: period,
    sections: {
      performance: {
        title: 'Performance',
        data: {
          leads: metrics.totals.leads,
          calls: metrics.totals.calls,
          reached: metrics.totals.contactsReached,
          booked: metrics.totals.estimatesBooked,
          won: metrics.totals.wonDeals,
          bookingRate: metrics.totals.bookingRate,
          speedToLeadMinutes: metrics.totals.speedToLeadMinutes
        }
      },
      revenue: {
        title: 'Revenue recovered',
        data: {
          revenueCents: metrics.totals.revenueCents,
          bookedValueCents: metrics.days.reduce((sum, day) => sum + day.bookedValueCents, 0)
        }
      },
      daily: {
        title: 'Daily trend',
        data: {
          days: metrics.days.map(({ day, leads, estimatesBooked }) => ({
            day,
            leads,
            estimatesBooked
          }))
        }
      },
      guarantee: { title: 'Booking guarantee', data: { result } }
    }
  };
}
