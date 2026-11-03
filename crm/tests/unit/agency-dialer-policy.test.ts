import { describe, expect, it } from 'vitest';
import {
  dialerBlockReason,
  NEVER_DIAL_NUMBERS,
  type DialerCandidate
} from '@/server/agency/dialer-policy';
const base: DialerCandidate = {
  firstName: 'Synthetic',
  lastName: null,
  companyName: null,
  primaryPhoneE164: '+12025550123',
  phones: ['+12025550123'],
  address: { state: 'CA' },
  source: 'agency_outbound_cold_call',
  doNotCallAt: null
};
describe('M16-06 F-74 human never-dial rules', () => {
  it.each([
    [{ address: { state: 'FL' } }, 'excluded_state'],
    [{ address: { region: 'Oklahoma' } }, 'excluded_state'],
    [{ address: { state: 'CA', region: 'Florida' } }, 'excluded_state'],
    [{ address: {} }, 'unknown_state'],
    [{ address: { state: 'ZZ' } }, 'unknown_state'],
    [{ address: { state: 'CA', region: 'NY' } }, 'unknown_state'],
    [{ firstName: 'AM-1 Roofing, Inc.' }, 'protected_business'],
    [{ companyName: 'AM 1 Roofing' }, 'protected_business'],
    [{ primaryPhoneE164: [...NEVER_DIAL_NUMBERS][0] }, 'protected_business'],
    [{ phones: [...NEVER_DIAL_NUMBERS] }, 'protected_business'],
    [{ doNotCallAt: '2026-11-01T12:00:00Z' }, 'dnc'],
    [{ primaryPhoneE164: null }, 'missing_phone'],
    [{ source: 'agency_outbound_email' }, 'not_phone_queue'],
    [{ primaryPhoneE164: '+12025550299' }, 'non_synthetic_phone']
  ] as Array<[Partial<DialerCandidate>, string]>)('blocks %j as %s', (patch, reason) => {
    expect(dialerBlockReason({ ...base, ...patch }, new Set(), false)).toBe(reason);
  });
  it('blocks active number DNC or phone opt-out independently of a contact flag', () => {
    expect(dialerBlockReason(base, new Set([base.primaryPhoneE164!]), false)).toBe('dnc');
    expect(dialerBlockReason(base, new Set(), true)).toBe('dnc');
  });
  it('allows a synthetic human-call candidate without requiring AI-call consent', () => {
    expect(dialerBlockReason(base, new Set(), false)).toBeNull();
    expect(dialerBlockReason({ ...base, address: { region: 'ca' } }, new Set(), false)).toBeNull();
  });
});
