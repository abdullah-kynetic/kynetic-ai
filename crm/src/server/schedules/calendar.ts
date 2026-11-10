/** Calendar helpers for the metrics and report crons. Days are 1–28 so every month has the day. */
export const DEFAULT_REPORT_DAY = 1;
export const MIN_REPORT_DAY = 1;
export const MAX_REPORT_DAY = 28;

export function parseReportDay(value: unknown): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isInteger(parsed) || parsed < MIN_REPORT_DAY || parsed > MAX_REPORT_DAY)
    return DEFAULT_REPORT_DAY;
  return parsed;
}

export function zonedDate(
  now: Date,
  timeZone: string
): { year: number; month: number; day: number } {
  let zone = timeZone;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(now);
  } catch {
    zone = 'UTC';
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: read('year'), month: read('month'), day: read('day') };
}

/** First UTC day of the calendar month before `month` (1–12). */
export function previousMonthStart(year: number, month: number): string {
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
}

export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addUtcDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}
