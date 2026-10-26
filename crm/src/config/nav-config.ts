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
    label: 'Settings',
    items: [
      {
        title: 'Business',
        url: '/dashboard/settings/business',
        icon: 'settings',
        isActive: false,
        items: []
      },
      {
        title: 'Team',
        url: '/dashboard/settings/team',
        icon: 'settings',
        isActive: false,
        access: { role: 'owner' },
        items: []
      }
    ]
  }
];
