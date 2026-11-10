import type { BusinessHours, Weekday } from '@/server/settings/hours';

export type CalendarView = 'month' | 'week' | 'day';

const WEEKDAYS: Weekday[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

export function parseCalendarView(value: string | undefined): CalendarView {
  return value === 'day' || value === 'month' || value === 'week' ? value : 'week';
}

export function addCalendarDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function addCalendarMonths(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const cursor = new Date(Date.UTC(year!, (month ?? 1) - 1 + months, 1));
  const last = new Date(
    Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)
  ).getUTCDate();
  const picked = Math.min(day ?? 1, last);
  return new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), picked))
    .toISOString()
    .slice(0, 10);
}

/** Monday = 0. */
export function mondayIndex(isoDate: string): number {
  const day = new Date(`${isoDate}T00:00:00.000Z`).getUTCDay();
  return (day + 6) % 7;
}

export function startOfWeek(isoDate: string): string {
  return addCalendarDays(isoDate, -mondayIndex(isoDate));
}

export function shiftAnchor(view: CalendarView, isoDate: string, direction: -1 | 1): string {
  if (view === 'month') return addCalendarMonths(isoDate, direction);
  if (view === 'week') return addCalendarDays(isoDate, direction * 7);
  return addCalendarDays(isoDate, direction);
}

/** Inclusive start and exclusive end dates for the visible calendar. */
export function visibleRange(view: CalendarView, isoDate: string): { start: string; end: string } {
  if (view === 'day') return { start: isoDate, end: addCalendarDays(isoDate, 1) };
  if (view === 'week') {
    const start = startOfWeek(isoDate);
    return { start, end: addCalendarDays(start, 7) };
  }
  const first = `${isoDate.slice(0, 7)}-01`;
  const start = startOfWeek(first);
  const nextMonth = addCalendarMonths(first, 1);
  const end = addCalendarDays(startOfWeek(addCalendarDays(nextMonth, -1)), 7);
  return { start, end };
}

const MINUTES = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

export function weekdayOf(isoDate: string): Weekday {
  return WEEKDAYS[mondayIndex(isoDate)] ?? 'mon';
}

/** True when the clock hour overlaps a configured open window. Empty hours are not shaded. */
export function hourIsOpen(hours: BusinessHours, isoDate: string, hour: number): boolean | null {
  const windows = hours[weekdayOf(isoDate)] ?? [];
  const configured = WEEKDAYS.some((day) => (hours[day] ?? []).length > 0);
  if (!configured) return null;
  const start = hour * 60;
  const end = start + 60;
  return windows.some((window) => MINUTES(window.open) < end && MINUTES(window.close) > start);
}

export function zonedDateTime(
  iso: string,
  timeZone: string
): { date: string; minutes: number; label: string } {
  const at = new Date(iso);
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(at);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit'
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  const hour = Number(get('hour'));
  const minute = Number(get('minute'));
  const label = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit'
  }).format(at);
  return { date, minutes: hour * 60 + minute, label };
}

/** UTC instant of midnight on a calendar date in a time zone. */
export function zonedMidnight(isoDate: string, timeZone: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  const target = Date.UTC(year!, (month ?? 1) - 1, day ?? 1, 0, 0);
  let utc = target;
  const read = (ms: number) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).formatToParts(new Date(ms));
    const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
    return Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'));
  };
  utc += target - read(utc);
  utc += target - read(utc);
  return new Date(utc);
}

export const CALENDAR_START_HOUR = 6;
export const CALENDAR_END_HOUR = 20;
