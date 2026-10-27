import { z } from 'zod';
import { isValidTimeZone } from '../consent/quiet-hours';

/** Weekday keys, Monday first. A missing or empty day means closed. */
export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export type Weekday = (typeof WEEKDAYS)[number];

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
const minutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

const windowSchema = z
  .object({ open: timeSchema, close: timeSchema })
  .strict()
  .refine((w) => minutes(w.close) > minutes(w.open), { message: 'close_before_open' });

const dayWindows = z
  .array(windowSchema)
  .max(4)
  .refine(
    (ws) => {
      const sorted = ws.toSorted((a, b) => minutes(a.open) - minutes(b.open));
      return sorted.every((w, i) => i === 0 || minutes(w.open) >= minutes(sorted[i - 1].close));
    },
    { message: 'overlapping_windows' }
  );

/** Stored in `tenants.business_hours`, read by the booking API and the outbound call windows. */
export const businessHoursSchema = z
  .object({
    mon: dayWindows.optional(),
    tue: dayWindows.optional(),
    wed: dayWindows.optional(),
    thu: dayWindows.optional(),
    fri: dayWindows.optional(),
    sat: dayWindows.optional(),
    sun: dayWindows.optional()
  })
  .strict();
export type BusinessHours = z.infer<typeof businessHoursSchema>;

const WEEKDAY_BY_SHORT: Record<string, Weekday> = {
  Mon: 'mon',
  Tue: 'tue',
  Wed: 'wed',
  Thu: 'thu',
  Fri: 'fri',
  Sat: 'sat',
  Sun: 'sun'
};

function localDayAndMinute(at: Date, tz: string): { day: Weekday; minute: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    weekday: 'short',
    hourCycle: 'h23',
    hour: 'numeric',
    minute: 'numeric'
  }).formatToParts(at);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const day = WEEKDAY_BY_SHORT[get('weekday')] ?? 'mon';
  return { day, minute: Number(get('hour')) * 60 + Number(get('minute')) };
}

/**
 * Is `at` inside the business hours in the tenant's time zone? Empty hours (nothing configured yet)
 * count as closed, so a tenant that never set hours is never booked or called by accident.
 * An invalid time zone also counts as closed.
 */
export function isWithinBusinessHours(hours: BusinessHours, tz: string, at: Date): boolean {
  if (!isValidTimeZone(tz)) return false;
  const { day, minute } = localDayAndMinute(at, tz);
  return (hours[day] ?? []).some((w) => minute >= minutes(w.open) && minute < minutes(w.close));
}

/**
 * Call-window start/end for the tenant-local day of `at`, as minutes. The outbound gate uses the
 * stricter of this and the legal window. Null when the business is closed all day.
 */
export function dayBounds(
  hours: BusinessHours,
  tz: string,
  at: Date
): { startMinute: number; endMinute: number }[] {
  if (!isValidTimeZone(tz)) return [];
  const { day } = localDayAndMinute(at, tz);
  return (hours[day] ?? []).map((w) => ({
    startMinute: minutes(w.open),
    endMinute: minutes(w.close)
  }));
}

export const serviceAreaSchema = z.union([
  z.object({ type: z.literal('none') }).strict(),
  z
    .object({
      type: z.literal('zips'),
      zips: z
        .array(z.string().regex(/^\d{5}$/))
        .min(1)
        .max(500)
    })
    .strict(),
  z
    .object({
      type: z.literal('radius'),
      centerZip: z.string().regex(/^\d{5}$/),
      miles: z.number().int().min(1).max(500)
    })
    .strict()
]);
export type ServiceArea = z.infer<typeof serviceAreaSchema>;

export const servicesSchema = z
  .array(z.string().trim().min(1).max(100))
  .max(50)
  .refine((s) => new Set(s.map((x) => x.toLowerCase())).size === s.length, {
    message: 'duplicate_service'
  });

export { isValidTimeZone };
