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
        title: 'Calls',
        url: '/dashboard/calls',
        icon: 'phone',
        isActive: false,
        module: 'alex_core',
        items: []
      },
      {
        title: 'Alex settings',
        url: '/dashboard/settings/alex',
        icon: 'settings',
        isActive: false,
        module: 'alex_core',
        items: []
      }
    ]
  }
];
