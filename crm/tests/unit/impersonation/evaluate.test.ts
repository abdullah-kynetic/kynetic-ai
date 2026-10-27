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
  readOnly: true,
  endedAt: null,
  lastSeenAt: ago(60_000),
  writeUntil: null,
  ...over
});

describe('evaluateSession (F-57, SECURITY 2.6)', () => {
  it('is read-only by default for admin and VA', () => {
    expect(evaluateSession(row(), admin, now)).toEqual({
      kind: 'active',
      readOnly: true,
      writeLapsed: false
    });
    expect(evaluateSession(row(), va, now)).toMatchObject({ kind: 'active', readOnly: true });
  });

  it('gives an admin write mode only inside the window', () => {
    const open = row({ readOnly: false, writeUntil: new Date(now.getTime() + 60_000) });
    expect(evaluateSession(open, admin, now)).toMatchObject({ kind: 'active', readOnly: false });
    const lapsed = row({ readOnly: false, writeUntil: ago(1) });
    expect(evaluateSession(lapsed, admin, now)).toEqual({
      kind: 'active',
      readOnly: true,
      writeLapsed: true
    });
  });

  it('never gives a VA write mode, even if the row says write', () => {
    const open = row({ readOnly: false, writeUntil: new Date(now.getTime() + 60_000) });
    expect(evaluateSession(open, va, now)).toMatchObject({ kind: 'active', readOnly: true });
  });

  it('ends an idle session after 30 minutes', () => {
    expect(evaluateSession(row({ lastSeenAt: ago(VIEW_AS.idleMs + 1) }), admin, now)).toEqual({
      kind: 'end',
      reason: 'idle'
    });
    expect(evaluateSession(row({ lastSeenAt: ago(VIEW_AS.idleMs) }), admin, now).kind).toBe(
      'active'
    );
  });

  it('ends the session when the Kynetic role is gone', () => {
    expect(evaluateSession(row(), { ...admin, kyneticRole: null }, now)).toEqual({
      kind: 'end',
      reason: 'role_lost'
    });
  });

  it('is invalid, and changes nothing, for another user, an ended row or pending TOTP', () => {
    expect(evaluateSession(row(), { ...admin, id: 'u2' }, now)).toEqual({ kind: 'invalid' });
    expect(evaluateSession(row({ endedAt: ago(5) }), admin, now)).toEqual({ kind: 'invalid' });
    expect(evaluateSession(row(), { ...admin, twoFactor: 'challenge' }, now)).toEqual({
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
