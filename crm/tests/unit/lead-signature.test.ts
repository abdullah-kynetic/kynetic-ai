import { describe, expect, it } from 'vitest';
import { normalizePhone } from '@/server/leads/payload';
import { signLeadBody, verifyLeadSignature } from '@/server/leads/signature';

const now = new Date('2026-10-26T12:00:00Z');
const ts = String(Math.floor(now.getTime() / 1000));
const body = '{"a":1}';

describe('lead signature (F-76)', () => {
  const base = { secret: 's3cret', timestamp: ts, rawBody: body, now };
  it('accepts a fresh, correct signature', () => {
    expect(verifyLeadSignature({ ...base, signature: signLeadBody('s3cret', ts, body) })).toBe(
      true
    );
  });
  it('refuses a wrong secret, changed body, stale or missing parts', () => {
    const good = signLeadBody('s3cret', ts, body);
    expect(verifyLeadSignature({ ...base, signature: signLeadBody('other', ts, body) })).toBe(
      false
    );
    expect(verifyLeadSignature({ ...base, rawBody: '{"a":2}', signature: good })).toBe(false);
    expect(verifyLeadSignature({ ...base, signature: null })).toBe(false);
    expect(verifyLeadSignature({ ...base, signature: 'short' })).toBe(false);
    expect(verifyLeadSignature({ ...base, timestamp: null, signature: good })).toBe(false);
    const old = String(Number(ts) - 301);
    expect(
      verifyLeadSignature({ ...base, timestamp: old, signature: signLeadBody('s3cret', old, body) })
    ).toBe(false);
  });
});

describe('normalizePhone', () => {
  it('normalizes US numbers and E.164, refuses the rest', () => {
    expect(normalizePhone('(555) 010-0142')).toBe('+15550100142');
    expect(normalizePhone('1-555-010-0142')).toBe('+15550100142');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('12345')).toBeNull();
    expect(normalizePhone('+0123456789')).toBeNull();
  });
});
