/** Client-safe referral vocabulary. No database imports: the forms import this file directly. */
export const REFERRAL_STATUSES = ['new', 'contacted', 'booked', 'won', 'lost'] as const;
export type ReferralStatus = (typeof REFERRAL_STATUSES)[number];

export const REFERRAL_REWARD_STATUSES = ['none', 'pending', 'paid'] as const;
export type ReferralRewardStatus = (typeof REFERRAL_REWARD_STATUSES)[number];

export const REFERRAL_STATUS_LABEL: Record<ReferralStatus, string> = {
  new: 'New',
  contacted: 'Contacted',
  booked: 'Booked',
  won: 'Won',
  lost: 'Lost'
};

export type ReferralRow = {
  id: string;
  referrerContactId: string;
  referrerName: string;
  refereeContactId: string | null;
  refereeName: string;
  refereePhone: string | null;
  status: ReferralStatus;
  rewardCents: number;
  rewardStatus: ReferralRewardStatus;
  notes: string;
  createdAt: string;
};
