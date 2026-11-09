import { it, expect, vi } from 'vitest';
import { deliverAgencyPreview } from '@/server/agency/messaging-policy';
it.each(['no_consent', 'quiet_hours', 'outbound_disabled', 'alex_paused', 'internal_dnc'] as const)(
  '%s prevents dispatch including replies',
  async (reason) => {
    const sink = vi.fn();
    expect(await deliverAgencyPreview({ allowed: false, reason }, sink)).toEqual({
      status: 'blocked',
      reason
    });
    expect(sink).not.toHaveBeenCalled();
  }
);
it('allows a synthetic sink only after all gates allow', async () => {
  const sink = vi.fn(async () => ({ providerRequests: 0 }));
  expect(await deliverAgencyPreview({ allowed: true }, sink)).toMatchObject({
    status: 'simulated'
  });
  expect(sink).toHaveBeenCalledOnce();
});
