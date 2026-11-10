import { z } from 'zod';
import { MAX_DASHBOARD_RANGE_DAYS, addCalendarDays, daysInclusive } from './formulas';

export const DASHBOARD_RANGE_NOTICE =
  'That date range is not valid, so this page shows the last 30 days.';

export function calendarDateInTimeZone(at: Date, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(at);
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(at);
  }
}

/** Inclusive last-N-days window, labeled in the tenant's time zone. */
export function presetRange(
  days: 7 | 30 | 90,
  now: Date,
  timeZone: string
): { from: string; to: string } {
  const to = calendarDateInTimeZone(now, timeZone);
  return { to, from: addCalendarDays(to, -(days - 1)) };
}

export function dashboardRangeSchema(today: string) {
  return z
    .object({
      from: z.iso.date(),
      to: z.iso.date()
    })
    .superRefine((value, ctx) => {
      if (value.from > value.to) ctx.addIssue({ code: 'custom', message: 'order' });
      if (value.to > today) ctx.addIssue({ code: 'custom', message: 'future' });
      if (daysInclusive(value.from, value.to) > MAX_DASHBOARD_RANGE_DAYS)
        ctx.addIssue({ code: 'custom', message: 'span' });
    });
}

/** URL `from` and `to`. A missing pair is the last 30 days. An invalid pair falls back and explains why. */
export function resolveDashboardRange(
  raw: { from?: string; to?: string },
  now: Date,
  timeZone: string
): { from: string; to: string; notice: string | null } {
  const fallback = presetRange(30, now, timeZone);
  if (!raw.from && !raw.to) return { ...fallback, notice: null };
  const today = calendarDateInTimeZone(now, timeZone);
  const parsed = dashboardRangeSchema(today).safeParse({ from: raw.from, to: raw.to });
  if (!parsed.success) return { ...fallback, notice: DASHBOARD_RANGE_NOTICE };
  return { from: parsed.data.from, to: parsed.data.to, notice: null };
}
