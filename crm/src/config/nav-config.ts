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
      },
      {
        title: 'My Tasks',
        url: '/dashboard/tasks',
        icon: 'circleCheck',
        isActive: false,
        shortcut: ['t', 't'],
        module: 'crm',
        level: 'lite',
        items: []
      }
    ]
  }
];
