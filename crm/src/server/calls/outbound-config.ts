import { z } from 'zod';
import { DEFAULT_WINDOW, type QuietWindow } from '../consent';

// `alex_configs.call_windows` and `alex_configs.retry` are free jsonb until the F-58 form (M8b) owns
// them, so this is the one place that reads them. Bad or missing values fall back to the defaults;
// a config can narrow the legal window, never widen it.

/** Delays after each attempt, in minutes: first call at once, then +5 min, then +60 min. */
export const DEFAULT_RETRY_DELAYS_MIN: readonly number[] = [5, 60];
export const MAX_RETRY_DELAYS = 5;

const hhmm = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
  .transform((v) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3)));

const windowSchema = z.object({ start: hhmm, end: hhmm });

/**
 * The window in lead-local time Alex may dial in: `{ "start": "09:00", "end": "17:00" }`, intersected
 * with the compliance window (08:00 to 21:00, SECURITY 3.4) so the stricter one wins. An empty or
 * unreadable window falls back to the compliance window rather than blocking every call.
 */
export function parseCallWindow(raw: unknown): QuietWindow {
  const parsed = windowSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_WINDOW;
  const startMinute = Math.max(DEFAULT_WINDOW.startMinute, parsed.data.start);
  const endMinute = Math.min(DEFAULT_WINDOW.endMinute, parsed.data.end);
  return startMinute < endMinute ? { startMinute, endMinute } : DEFAULT_WINDOW;
}

const retrySchema = z.object({
  delaysMinutes: z.array(z.number().int().min(1).max(1440)).max(MAX_RETRY_DELAYS)
});

/** Minutes to wait after attempt N before attempt N+1. `{ "delaysMinutes": [] }` means no retries. */
export function parseRetryDelays(raw: unknown): readonly number[] {
  const parsed = retrySchema.safeParse(raw);
  return parsed.success ? parsed.data.delaysMinutes : DEFAULT_RETRY_DELAYS_MIN;
}
