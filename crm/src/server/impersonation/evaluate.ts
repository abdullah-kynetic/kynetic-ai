import { z } from 'zod';

// SECURITY 2.6 (changed 2026-11-17): a view-as session is strictly read-only, with no write mode and
// no override. It ends 30 minutes after it starts, whatever the activity (a hard cap, not an idle
// timer). The reason bounds are DC-093.
export const VIEW_AS = {
  maxMs: 30 * 60 * 1000,
  reasonMin: 10,
  reasonMax: 500
} as const;

export const reasonSchema = z
  .string()
  .trim()
  .min(VIEW_AS.reasonMin, `Give a reason of at least ${VIEW_AS.reasonMin} characters.`)
  .max(VIEW_AS.reasonMax, `Keep the reason under ${VIEW_AS.reasonMax} characters.`);

export type SessionRow = {
  impersonatorUserId: string;
  endedAt: Date | null;
  startedAt: Date;
};

export type Viewer = {
  id: string;
  kyneticRole: 'admin' | 'va' | null;
  twoFactor: 'not_required' | 'enrol' | 'challenge' | 'verified';
};

export type SessionDecision =
  /** Usable. Always read-only. `expiresAt` is the hard end, 30 minutes after the start. */
  | { kind: 'active'; readOnly: true; expiresAt: Date }
  /** Must be closed now, with this reason. */
  | { kind: 'end'; reason: 'expired' | 'role_lost' }
  /** Not usable by this caller; nothing is changed (a copied cookie must not end someone's session). */
  | { kind: 'invalid' };

/**
 * Pure decision for one request. Everything is re-checked from live data: the caller must be the
 * session's own Kynetic user with a verified staff session, and the result is read-only whatever the
 * stored row says, so a hand-edited row cannot switch writes on.
 */
export function evaluateSession(row: SessionRow, viewer: Viewer, now: Date): SessionDecision {
  if (row.endedAt) return { kind: 'invalid' };
  if (row.impersonatorUserId !== viewer.id) return { kind: 'invalid' };
  if (!viewer.kyneticRole) return { kind: 'end', reason: 'role_lost' };
  if (viewer.twoFactor !== 'verified') return { kind: 'invalid' };
  const expiresAt = new Date(row.startedAt.getTime() + VIEW_AS.maxMs);
  if (now.getTime() >= expiresAt.getTime()) return { kind: 'end', reason: 'expired' };
  return { kind: 'active', readOnly: true, expiresAt };
}

const uuid = z.uuid();

/** The cookie holds the session id and its tenant id; both are claims, checked against the row. */
export function formatCookie(sessionId: string, tenantId: string): string {
  return `${sessionId}.${tenantId}`;
}

export function parseCookie(
  value: string | undefined
): { sessionId: string; tenantId: string } | null {
  if (!value) return null;
  const [sessionId, tenantId, extra] = value.split('.');
  if (
    extra !== undefined ||
    !uuid.safeParse(sessionId).success ||
    !uuid.safeParse(tenantId).success
  )
    return null;
  return { sessionId, tenantId };
}

export const VIEW_AS_COOKIE = 'view_as';
/** The admin page the session was started from; Exit and expiry send the admin back there. */
export const VIEW_AS_RETURN_COOKIE = 'view_as_return';
