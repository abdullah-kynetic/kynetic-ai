import type { NotificationType } from './types';

/** Tabs on the full page (DESIGN_SYSTEM "Notifications"). `unread` filters on read state, the rest on type. */
export const NOTIFICATION_TABS = {
  all: { label: 'All' },
  unread: { label: 'Unread' },
  leads: { label: 'Leads', kinds: ['new_lead', 'hot_lead'] },
  appointments: { label: 'Appointments', kinds: ['booked'] },
  tasks: { label: 'Tasks', kinds: ['task_due'] },
  other: {
    label: 'Other',
    kinds: ['report_ready', 'action_needed', 'deal_won', 'mention', 'support_reply']
  }
} as const satisfies Record<string, { label: string; kinds?: readonly NotificationType[] }>;
export type NotificationTab = keyof typeof NOTIFICATION_TABS;
