import { describe, expect, it } from 'vitest';
import { currentConsent } from '@/server/contacts/detail';

const row = (
  kind: string,
  source = 'form',
  capturedAt = '2026-10-01T00:00:00Z',
  revokedAt: string | null = null
) => ({
  kind,
  source,
  capturedAt,
  revokedAt
});

describe('F-06: currentConsent', () => {
  it('reads no rows as not recorded', () => {
    expect(currentConsent('sms', []).state).toBe('none');
  });
  it('reads express consent, a revoke, and self opt-out', () => {
    expect(currentConsent('sms', [row('express_written')]).state).toBe('consented');
    expect(
      currentConsent('sms', [
        row('express_written', 'form', '2026-10-01T00:00:00Z', '2026-10-02T00:00:00Z')
      ]).state
    ).toBe('revoked');
    expect(currentConsent('sms', [row('opt_out', 'sms_keyword')]).state).toBe('opted_out');
    expect(currentConsent('sms', [row('opt_out', 'staff')]).state).toBe('revoked');
  });
  it('lets the most restrictive row win on a timestamp tie', () => {
    expect(currentConsent('sms', [row('express_written'), row('dnc')]).state).toBe('dnc');
  });
  it('lets a newer row override an older one', () => {
    expect(
      currentConsent('sms', [
        row('express_written', 'form', '2026-10-03T00:00:00Z'),
        row('opt_out', 'sms_keyword')
      ]).state
    ).toBe('consented');
  });
});
