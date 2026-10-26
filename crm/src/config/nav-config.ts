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
        title: 'Pipeline stages',
        url: '/dashboard/settings/pipeline',
        icon: 'settings',
        isActive: false,
        module: 'crm',
        level: 'lite',
        access: { role: 'owner' },
        items: []
      },
      {
        title: 'Tags',
        url: '/dashboard/settings/tags',
        icon: 'settings',
        isActive: false,
        module: 'crm',
        level: 'lite',
        access: { role: 'owner' },
        items: []
      },
      {
        title: 'Notification preferences',
        url: '/dashboard/settings/notifications',
        icon: 'settings',
        isActive: false,
        items: []
      }
    ]
  }
];
