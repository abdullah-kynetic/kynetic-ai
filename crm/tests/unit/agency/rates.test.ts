import { describe, it, expect } from 'vitest';
import { agencyRates, percent } from '@/server/agency/rates';
describe('agency rates', () => {
  it('has no misleading zero when denominators are empty', () => {
    expect(agencyRates([], [])).toMatchObject({ pickRate: null, replyRate: null });
    expect(percent(null)).toBe('—');
  });
  it('counts human answers and excludes voicemail/no answer/unknown', () => {
    expect(
      agencyRates(['connected', 'interested', 'no_answer', 'voicemail', 'unknown'], [])
    ).toMatchObject({ picked: 2, attempted: 5, pickRate: 0.4 });
    expect(percent(0.4)).toBe('40.0%');
  });
  it('deduplicates prospects and requires reply after outreach', () => {
    const at = (n: number) => new Date(n * 1000).toISOString();
    expect(
      agencyRates(
        [],
        [
          { contactId: 'a', direction: 'inbound', at: at(1) },
          { contactId: 'a', direction: 'outbound', at: at(2) },
          { contactId: 'a', direction: 'outbound', at: at(3) },
          { contactId: 'a', direction: 'inbound', at: at(4) },
          { contactId: 'a', direction: 'inbound', at: at(5) },
          { contactId: 'b', direction: 'outbound', at: at(2) },
          { contactId: 'c', direction: 'inbound', at: at(4) }
        ]
      )
    ).toMatchObject({ contacted: 2, replied: 1, replyRate: 0.5 });
  });
});
