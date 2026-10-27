export const NOTIFICATION_TYPES = [
  'new_lead',
  'booked',
  'task_due',
  'report_ready',
  'action_needed',
  'deal_won',
  'hot_lead',
  'mention'
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
