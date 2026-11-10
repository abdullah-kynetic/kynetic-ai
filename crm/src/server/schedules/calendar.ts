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

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

export function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return 'UTC';
  }
}

export function zonedDate(
  now: Date,
  timeZone: string
): { year: number; month: number; day: number } {
  const zone = safeTimeZone(timeZone);
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

/** Local hour 0–23 and weekday 1 (Monday) through 7 (Sunday). */
export function zonedClock(
  now: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number; weekday: number } {
  const zone = safeTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    weekday: 'short',
    hourCycle: 'h23'
  }).formatToParts(now);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  const date = zonedDate(now, zone);
  const weekdayIndex = WEEKDAYS.indexOf(read('weekday') as (typeof WEEKDAYS)[number]);
  const weekday = weekdayIndex === 0 ? 7 : weekdayIndex;
  return { ...date, hour: Number(read('hour')), weekday };
}

/** UTC instant when it is 00:00 on the first of the local month. */
export function zonedMonthStart(now: Date, timeZone: string): Date {
  const zone = safeTimeZone(timeZone);
  const { year, month } = zonedDate(now, zone);
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  });
  let guess = new Date(Date.UTC(year, month - 1, 1));
  for (let i = 0; i < 4; i += 1) {
    const parts = formatter.formatToParts(guess);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      Number(parts.find((part) => part.type === type)?.value);
    const seen = Date.UTC(
      read('year'),
      read('month') - 1,
      read('day'),
      read('hour'),
      read('minute'),
      read('second')
    );
    const wanted = Date.UTC(year, month - 1, 1);
    guess = new Date(guess.getTime() + (wanted - seen));
  }
  return guess;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Monday through Sunday of the week before the local date of `now`. */
export function previousWeekRange(now: Date, timeZone: string): { from: string; to: string } {
  const local = zonedClock(now, timeZone);
  const today = new Date(Date.UTC(local.year, local.month - 1, local.day));
  const thisMonday = new Date(today);
  thisMonday.setUTCDate(today.getUTCDate() - (local.weekday - 1));
  const lastMonday = new Date(thisMonday);
  lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
  const lastSunday = new Date(thisMonday);
  lastSunday.setUTCDate(thisMonday.getUTCDate() - 1);
  return { from: isoDate(lastMonday), to: isoDate(lastSunday) };
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
