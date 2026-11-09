import { z } from 'zod';
export const campaignStep = z.strictObject({
  channel: z.enum(['call', 'sms', 'email', 'dm']),
  delayDays: z.number().int().min(0).max(365),
  instructions: z.string().trim().min(1).max(2000)
});
export const campaignPlan = z.array(campaignStep).min(1).max(20);
export type CampaignStep = z.infer<typeof campaignStep>;
export const AGENCY_CALLING = {
  mode: 'manual',
  provider: null,
  agentId: null,
  automaticDispatch: false
} as const;
export function campaignStop(f: {
  deleted: boolean;
  optedOut: boolean;
  replied: boolean;
  booked: boolean;
  closed: boolean;
}) {
  return f.deleted
    ? 'contact_unavailable'
    : f.optedOut
      ? 'opted_out'
      : f.replied
        ? 'replied'
        : f.booked
          ? 'booked'
          : f.closed
            ? 'closed'
            : null;
}
