export const ACTIVITY_TYPES = [
  'call',
  'sms',
  'email',
  'stage_change',
  'note',
  'task',
  'appointment',
  'automation',
  'system',
  'import'
] as const;
export const ACTOR_TYPES = ['user', 'alex', 'automation', 'system'] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];
