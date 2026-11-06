import { it, expect } from 'vitest';
import { AGENCY_CALLING, campaignPlan, campaignStop } from '@/server/agency/campaign-policy';
it('manual mode has no vendor/agent/send capability', () => {
  expect(AGENCY_CALLING).toEqual({
    mode: 'manual',
    provider: null,
    agentId: null,
    automaticDispatch: false
  });
  expect(
    campaignPlan.safeParse([{ channel: 'ai_call', delayDays: 0, instructions: 'x' }]).success
  ).toBe(false);
});
it.each(['deleted', 'optedOut', 'replied', 'booked', 'closed'] as const)('stops for %s', (key) => {
  expect(
    campaignStop({
      deleted: false,
      optedOut: false,
      replied: false,
      booked: false,
      closed: false,
      [key]: true
    })
  ).not.toBeNull();
});
it('requires explicit valid steps and delays', () => {
  expect(campaignPlan.safeParse([]).success).toBe(false);
  expect(
    campaignPlan.safeParse([{ channel: 'call', delayDays: -1, instructions: 'x' }]).success
  ).toBe(false);
});
