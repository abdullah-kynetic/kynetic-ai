import { describe, expect, it } from 'vitest';
import { syntheticLeadSchema } from '@/server/agency';
const lead = {
  firstName: 'Synthetic',
  email: 'agency@example.test',
  direction: 'inbound',
  channel: 'form'
};
describe('agency required source model', () => {
  it('requires both direction and channel', () => {
    expect(syntheticLeadSchema.safeParse(lead).success).toBe(true);
    for (const key of ['direction', 'channel']) {
      const missing = { ...lead };
      delete missing[key as keyof typeof missing];
      expect(syntheticLeadSchema.safeParse(missing).success).toBe(false);
    }
  });
  it.each(['FL', 'OK'])('rejects excluded business state %s', (state) => {
    expect(syntheticLeadSchema.safeParse({ ...lead, state }).success).toBe(false);
  });
  it('does not accept real emails or contradictory source directions', () => {
    expect(syntheticLeadSchema.safeParse({ ...lead, email: 'customer@example.com' }).success).toBe(
      false
    );
    expect(syntheticLeadSchema.safeParse({ ...lead, channel: 'cold_call' }).success).toBe(false);
  });
});
