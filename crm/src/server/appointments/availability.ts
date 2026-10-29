import { isWithinBusinessHours, type BusinessHours } from '../settings/hours';

export type AvailabilityAppointment = { startsAt: Date; endsAt: Date };

export type AvailabilityInput = {
  hours: BusinessHours;
  timezone: string;
  from: Date;
  to: Date;
  durationMinutes: number;
  bufferMinutes?: number;
  slotMinutes?: number;
  existing?: readonly AvailabilityAppointment[];
};

const minuteMs = 60_000;

/**
 * Returns candidate start times inside business hours, excluding existing appointments and their
 * buffers. Dates remain instants; business-hours checks are evaluated in the tenant timezone, so
 * DST transitions do not silently turn a closed or skipped local time into a bookable slot.
 */
export function availableSlots(input: AvailabilityInput): Date[] {
  const {
    hours,
    timezone,
    from,
    to,
    durationMinutes,
    bufferMinutes = 0,
    slotMinutes = durationMinutes,
    existing = []
  } = input;
  if (
    !Number.isInteger(durationMinutes) ||
    durationMinutes <= 0 ||
    !Number.isInteger(bufferMinutes) ||
    bufferMinutes < 0 ||
    !Number.isInteger(slotMinutes) ||
    slotMinutes <= 0 ||
    from >= to
  ) {
    return [];
  }

  const durationMs = durationMinutes * minuteMs;
  const bufferMs = bufferMinutes * minuteMs;
  const startMs = from.getTime();
  const endMs = to.getTime();
  const blocked = existing.map((a) => ({
    start: a.startsAt.getTime() - bufferMs,
    end: a.endsAt.getTime() + bufferMs
  }));
  const slots: Date[] = [];

  for (let at = startMs; at + durationMs <= endMs; at += slotMinutes * minuteMs) {
    const start = new Date(at);
    const end = new Date(at + durationMs);
    if (!isWithinBusinessHours(hours, timezone, start)) continue;
    if (!isWithinBusinessHours(hours, timezone, new Date(end.getTime() - 1))) continue;
    if (blocked.some((b) => at < b.end && at + durationMs > b.start)) continue;
    slots.push(start);
  }
  return slots;
}
