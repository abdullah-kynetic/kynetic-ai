import { it, expect } from 'vitest';
import { agencyDate, agencyDateTime, agencyBillingCycle } from '@/components/agency/format';
it('does not shift date-only invoice due dates to the prior Pacific day', () => {
  expect(agencyDate('2026-11-01')).toBe('Nov 1, 2026');
});
it('rejects missing and rolled-over dates rather than inventing a date', () => {
  expect(agencyDate('2026-02-31')).toBe('—');
  expect(agencyDateTime('invalid')).toBe('—');
});
it('uses Pacific time consistently across daylight saving transitions', () => {
  expect(agencyDateTime('2026-07-05T18:00:00Z')).toContain('11:00 AM');
  expect(agencyDateTime('2026-11-05T18:00:00Z')).toContain('10:00 AM');
});
it('turns internal billing keys into labels without changing the stored values', () => {
  expect(agencyBillingCycle('setup/0')).toBe('Setup payment 1');
  expect(agencyBillingCycle('monthly/2026-11')).toBe('Monthly · Nov 2026');
});
