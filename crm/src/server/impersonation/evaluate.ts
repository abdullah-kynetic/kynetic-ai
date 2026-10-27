import { z } from 'zod';

// SECURITY 2.6 (Decided 2026-10-25): 30-minute idle expiry; write mode is admin only, needs its own
// reason and lasts 30 minutes. The reason bounds are DC-093.
export const VIEW_AS = {
  idleMs: 30 * 60 * 1000,
  writeMs: 30 * 60 * 1000,
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
  readOnly: boolean;
  endedAt: Date | null;
  lastSeenAt: Date;
  writeUntil: Date | null;
};

export type Viewer = {
  id: string;
  kyneticRole: 'admin' | 'va' | null;
  twoFactor: 'not_required' | 'enrol' | 'challenge' | 'verified';
};

export type SessionDecision =
  /** Usable. `readOnly` is the effective mode; `writeLapsed` means the stored write mode has run out. */
  | { kind: 'active'; readOnly: boolean; writeLapsed: boolean }
  /** Must be closed now, with this reason. */
  | { kind: 'end'; reason: 'idle' | 'role_lost' }
  /** Not usable by this caller; nothing is changed (a copied cookie must not end someone's session). */
  | { kind: 'invalid' };

/**
 * Pure decision for one request. Everything is re-checked from live data: the caller must be the
 * session's own Kynetic user with TOTP passed, and a VA is read-only whatever the row says, so a
 * hand-edited row cannot give a VA write mode.
 */
export function evaluateSession(row: SessionRow, viewer: Viewer, now: Date): SessionDecision {
  if (row.endedAt) return { kind: 'invalid' };
  if (row.impersonatorUserId !== viewer.id) return { kind: 'invalid' };
  if (!viewer.kyneticRole) return { kind: 'end', reason: 'role_lost' };
  if (viewer.twoFactor !== 'verified') return { kind: 'invalid' };
  if (now.getTime() - row.lastSeenAt.getTime() > VIEW_AS.idleMs)
    return { kind: 'end', reason: 'idle' };

  const writeLapsed =
    !row.readOnly && (!row.writeUntil || row.writeUntil.getTime() <= now.getTime());
  const readOnly = viewer.kyneticRole !== 'admin' || row.readOnly || writeLapsed;
  return { kind: 'active', readOnly, writeLapsed };
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
