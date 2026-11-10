import { sql } from 'drizzle-orm';
import type { Tx } from '../db/client';

/**
 * Shared dashboard and monthly-report formulas (F-01).
 * Lead intake is a contact whose source is the portal form and that was not imported.
 */
export const LEAD_INTAKE_SOURCE = 'form';
export const MAX_DASHBOARD_RANGE_DAYS = 366;

/** Median of the minute gaps. Null when there is no call attempt. Even counts average the two middle values, then round to the nearest minute. */
export function medianSpeedToLeadMinutes(samples: readonly number[]): number | null {
  if (samples.length === 0) return null;
  const sorted = samples.toSorted((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
  return Math.round(median);
}

/** Estimates booked divided by leads, as a whole percent. Null when there are no leads. */
export function bookingRatePercent(estimatesBooked: number, leads: number): number | null {
  if (!Number.isFinite(leads) || leads <= 0) return null;
  if (!Number.isFinite(estimatesBooked) || estimatesBooked < 0) return null;
  return Math.round((estimatesBooked / leads) * 100);
}

export function addCalendarDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function daysInclusive(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

/**
 * Median minutes from lead-intake contact creation to the first outbound call attempt in the
 * inclusive calendar window. The window is UTC dates, the same dates `metrics_daily.day` uses.
 */
export async function measureSpeedToLeadMinutes(
  tx: Tx,
  fromInclusive: string,
  toInclusive: string
): Promise<number | null> {
  const endExclusive = addCalendarDays(toInclusive, 1);
  const fromIso = `${fromInclusive}T00:00:00.000Z`;
  const endIso = `${endExclusive}T00:00:00.000Z`;
  const rows = await tx.execute<{ minutes: number | string | null }>(sql`
    with leads as (
      select c.id, c.created_at
      from contacts c
      where c.deleted_at is null
        and c.import_batch_id is null
        and c.imported_source is null
        and c.source = ${LEAD_INTAKE_SOURCE}
        and c.created_at >= ${fromIso}
        and c.created_at < ${endIso}
    ),
    first_attempt as (
      select l.id, min(call.started_at) as started_at
      from leads l
      join calls call on call.contact_id = l.id
        and call.direction = 'outbound'
        and call.started_at >= l.created_at
        and call.started_at >= ${fromIso}
        and call.started_at < ${endIso}
      group by l.id
    )
    select extract(epoch from (f.started_at - l.created_at)) / 60.0 as minutes
    from first_attempt f
    join leads l on l.id = f.id
  `);
  const samples = [...rows]
    .map((row) => Number(row.minutes))
    .filter((n) => Number.isFinite(n) && n >= 0);
  return medianSpeedToLeadMinutes(samples);
}
