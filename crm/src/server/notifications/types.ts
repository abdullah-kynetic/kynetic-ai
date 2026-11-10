export const NOTIFICATION_TYPES = [
  'new_lead',
  'booked',
  'task_due',
  'report_ready',
  'action_needed',
  'deal_won',
  'hot_lead',
  'mention',
  'support_reply',
  'support_request'
] as const;

/** These types stay in the bell. Email stays off until the person turns it on. */
export const EMAIL_OFF_BY_DEFAULT: ReadonlySet<NotificationType> = new Set([
  'support_reply',
  'support_request'
]);
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
