import { describe, expect, it } from 'vitest';
import {
  evaluateSession,
  formatCookie,
  parseCookie,
  reasonSchema,
  VIEW_AS,
  type SessionRow,
  type Viewer
} from '@/server/impersonation/evaluate';

const now = new Date('2026-10-26T12:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);
const admin: Viewer = { id: 'u1', kyneticRole: 'admin', twoFactor: 'verified' };
const va: Viewer = { id: 'u1', kyneticRole: 'va', twoFactor: 'verified' };
const row = (over: Partial<SessionRow> = {}): SessionRow => ({
  impersonatorUserId: 'u1',
  endedAt: null,
  startedAt: ago(60_000),
  ...over
});

describe('evaluateSession (F-57, SECURITY 2.6)', () => {
  it('is always read-only, for admin and VA, with a hard end 30 minutes after the start', () => {
    for (const viewer of [admin, va]) {
      const d = evaluateSession(row(), viewer, now);
      expect(d).toMatchObject({ kind: 'active', readOnly: true });
      if (d.kind === 'active')
        expect(d.expiresAt.getTime()).toBe(now.getTime() - 60_000 + VIEW_AS.maxMs);
    }
  });

  it('has no write mode: extra stored write fields change nothing', () => {
    const edited = {
      ...row(),
      readOnly: false,
      writeReason: 'Fixing a stage the owner mis-set',
      writeUntil: new Date(now.getTime() + 60_000)
    } as unknown as SessionRow;
    for (const viewer of [admin, va])
      expect(evaluateSession(edited, viewer, now)).toMatchObject({
        kind: 'active',
        readOnly: true
      });
  });

  it('ends at exactly 30 minutes after the start, however recently it was used', () => {
    expect(VIEW_AS.maxMs).toBe(30 * 60 * 1000);
    expect(evaluateSession(row({ startedAt: ago(VIEW_AS.maxMs - 1) }), admin, now).kind).toBe(
      'active'
    );
    expect(evaluateSession(row({ startedAt: ago(VIEW_AS.maxMs) }), admin, now)).toEqual({
      kind: 'end',
      reason: 'expired'
    });
    expect(evaluateSession(row({ startedAt: ago(VIEW_AS.maxMs + 5_000) }), admin, now)).toEqual({
      kind: 'end',
      reason: 'expired'
    });
  });

  it('ends the session when the Kynetic role is gone', () => {
    expect(evaluateSession(row(), { ...admin, kyneticRole: null }, now)).toEqual({
      kind: 'end',
      reason: 'role_lost'
    });
  });

  it('is invalid, and changes nothing, for another user, an ended row or an unverified staff session', () => {
    expect(evaluateSession(row(), { ...admin, id: 'u2' }, now)).toEqual({ kind: 'invalid' });
    expect(evaluateSession(row({ endedAt: ago(5) }), admin, now)).toEqual({ kind: 'invalid' });
    expect(evaluateSession(row(), { ...admin, twoFactor: 'challenge' }, now)).toEqual({
      kind: 'invalid'
    });
    expect(evaluateSession(row(), { ...admin, twoFactor: 'enrol' }, now)).toEqual({
      kind: 'invalid'
    });
  });
});

describe('cookie and reason', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  it('round-trips and rejects anything that is not two UUIDs', () => {
    expect(parseCookie(formatCookie(a, b))).toEqual({ sessionId: a, tenantId: b });
    for (const bad of [undefined, '', a, `${a}.${b}.x`, `${a}.nope`, `x.${b}`])
      expect(parseCookie(bad)).toBeNull();
  });
  it('requires a real reason', () => {
    expect(reasonSchema.safeParse('   short ').success).toBe(false);
    expect(reasonSchema.safeParse('Checking the reported booking').success).toBe(true);
    expect(reasonSchema.safeParse('x'.repeat(501)).success).toBe(false);
  });
});
