/** Contact window decided 2026-10-25 (PRD decision 18, SECURITY 3.4): 08:00 to 21:00 lead-local. */
export const DEFAULT_WINDOW = { startMinute: 8 * 60, endMinute: 21 * 60 } as const;

export type QuietWindow = { startMinute: number; endMinute: number };

export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz) return false;
  try {
    return !!new Intl.DateTimeFormat('en-US', { timeZone: tz });
  } catch {
    return false;
  }
}

type Local = { year: number; month: number; day: number; minuteOfDay: number };

function localParts(at: Date, tz: string): Local {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric'
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return {
    year: n('year'),
    month: n('month'),
    day: n('day'),
    minuteOfDay: n('hour') * 60 + n('minute')
  };
}

/** Milliseconds the zone is ahead of UTC at the given instant. */
function offsetMs(at: Date, tz: string): number {
  const l = localParts(at, tz);
  const asUtc = Date.UTC(l.year, l.month - 1, l.day, 0, l.minuteOfDay);
  return asUtc - Math.floor(at.getTime() / 60000) * 60000;
}

/** The UTC instant at which the wall clock in `tz` reads the given local date and minute. */
function localToUtc(year: number, month: number, day: number, minuteOfDay: number, tz: string) {
  const guess = Date.UTC(year, month - 1, day, 0, minuteOfDay);
  let utc = guess - offsetMs(new Date(guess), tz);
  utc = guess - offsetMs(new Date(utc), tz); // second pass lands correctly across a DST change
  const landed = localParts(new Date(utc), tz);
  if (landed.day !== day || landed.minuteOfDay !== minuteOfDay) {
    // The wall-clock time was skipped (spring forward). Use the offset from before the change, which
    // is the instant the clock first reads at or after it, rather than an hour early.
    const before = Math.min(
      offsetMs(new Date(guess - 12 * 3_600_000), tz),
      offsetMs(new Date(guess + 12 * 3_600_000), tz)
    );
    utc = guess - before;
  }
  return new Date(utc);
}

export type WindowCheck = { open: true } | { open: false; nextOpen: Date };

/** Is `now` inside the contact window in `tz`? When not, when does the window next open? */
export function checkWindow(
  now: Date,
  tz: string,
  window: QuietWindow = DEFAULT_WINDOW
): WindowCheck {
  const l = localParts(now, tz);
  if (l.minuteOfDay >= window.startMinute && l.minuteOfDay < window.endMinute) {
    return { open: true };
  }
  const dayShift = l.minuteOfDay < window.startMinute ? 0 : 1;
  const day = new Date(Date.UTC(l.year, l.month - 1, l.day + dayShift));
  return {
    open: false,
    nextOpen: localToUtc(
      day.getUTCFullYear(),
      day.getUTCMonth() + 1,
      day.getUTCDate(),
      window.startMinute,
      tz
    )
  };
}

/** Stricter of two windows: the later start and the earlier end. */
export function intersect(a: QuietWindow, b: QuietWindow): QuietWindow {
  return {
    startMinute: Math.max(a.startMinute, b.startMinute),
    endMinute: Math.min(a.endMinute, b.endMinute)
  };
}
