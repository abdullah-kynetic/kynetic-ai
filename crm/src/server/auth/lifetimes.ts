// SECURITY 2.1 (Decided 2026-10-25): staff 12 h idle and 7 days absolute; client users 30 days
// sliding and 90 days absolute.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export const LIFETIMES = {
  staff: { idleMs: 12 * HOUR, absoluteMs: 7 * DAY },
  client: { idleMs: 30 * DAY, absoluteMs: 90 * DAY },
  /** Staff signed in by emailed code (STAFF_EMAIL_LOGIN): one 30 day session, no authenticator. */
  staffEmailCode: { idleMs: 30 * DAY, absoluteMs: 30 * DAY }
} as const;

/** Longest a session row may live before the library itself drops it. */
export const SESSION_EXPIRES_IN_SECONDS = (30 * DAY) / 1000;
/** Refresh cadence for an approved session-issuance flow; this verifier never extends sessions. */
export const SESSION_UPDATE_AGE_SECONDS = 5 * 60;

export function sessionExpired(
  s: { createdAt: Date; updatedAt: Date },
  staff: boolean,
  now: Date,
  staffEmailLogin = false
): boolean {
  const l = !staff
    ? LIFETIMES.client
    : staffEmailLogin
      ? LIFETIMES.staffEmailCode
      : LIFETIMES.staff;
  return (
    now.getTime() - s.updatedAt.getTime() > l.idleMs ||
    now.getTime() - s.createdAt.getTime() > l.absoluteMs
  );
}
