import { and, asc, between } from 'drizzle-orm';
import { z } from 'zod';
import { metricsDaily, tenants } from '@/server/db/schema';
import { errorResponse, ValidationError } from '@/server/errors';
import { addCalendarDays, daysInclusive } from '@/server/metrics/formulas';
import { presetRange } from '@/server/metrics/range';
import { withServiceAuth, withServiceTenant } from '@/server/service-auth';
import { parseSearchParams } from '@/server/validation';

export const dynamic = 'force-dynamic';

const MAX_DAYS = 90;
const querySchema = z.strictObject({
  from: z.iso.date().optional(),
  to: z.iso.date().optional()
});

// Daily roll-up rows for this client, inclusive range, at most 90 days. Default: the last 30 days in
// the client's time zone. Aggregates only, no personal data.
export const GET = withServiceAuth(
  async (request, svc) => {
    try {
      const q = parseSearchParams(new URL(request.url), querySchema);
      const data = await withServiceTenant(svc, async (tx) => {
        const [t] = await tx.select({ timezone: tenants.timezone }).from(tenants).limit(1);
        const def = presetRange(30, new Date(), t?.timezone ?? 'UTC');
        const to = q.to ?? def.to;
        const from = q.from ?? (q.to ? addCalendarDays(to, -29) : def.from);
        if (from > to || daysInclusive(from, to) > MAX_DAYS) {
          throw new ValidationError({
            from: ['range_invalid_or_over_90_days']
          });
        }
        const rows = await tx
          .select()
          .from(metricsDaily)
          .where(and(between(metricsDaily.day, from, to)))
          .orderBy(asc(metricsDaily.day));
        return {
          from,
          to,
          days: rows.map((r) => ({
            day: r.day,
            leads: r.leads,
            calls: r.calls,
            contactsReached: r.contactsReached,
            estimatesBooked: r.estimatesBooked,
            bookedValueCents: r.bookedValueCents,
            wonRevenueCents: r.wonRevenueCents,
            avgSpeedToLeadS: r.avgSpeedToLeadS === null ? null : Number(r.avgSpeedToLeadS),
            speedToLeadSamples: r.speedToLeadSamples
          }))
        };
      });
      return Response.json({ ok: true, data }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error) {
      return errorResponse(error);
    }
  },
  { requiredScope: 'metrics:read' }
);
