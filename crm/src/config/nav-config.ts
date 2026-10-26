import { MESSAGING_MODULES } from '@/server/modules/keys';
import { NavGroup } from '@/types';

/**
 * Sidebar and Cmd+K navigation registry. Entries that belong to a module declare `module` (and `level`
 * for crm); `visibleNavGroups` filters them per tenant. Feature tasks add their entries here.
 */
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Dashboard',
        url: '/dashboard',
        icon: 'dashboard',
        isActive: false,
        shortcut: ['d', 'd'],
        items: []
      }
    ]
  },
  {
    label: 'Activity',
    items: [
      {
        title: 'Messages',
        url: '/dashboard/messages',
        icon: 'chat',
        isActive: false,
        anyModule: [...MESSAGING_MODULES],
        items: []
      }
    ]
  }
];
