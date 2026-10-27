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
        title: 'Alex settings',
        url: '/dashboard/settings/alex',
        icon: 'settings',
        isActive: false,
        module: 'alex_core',
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
        title: 'Branding',
        url: '/dashboard/settings/branding',
      }
    ]
  }
];

/**
 * Admin-side registry (M8a-01). Every `/admin` page is reachable only by Kynetic staff (SECURITY 2.2);
 * M8a and M8b tasks add their entries here. Entries carry no `module`: the admin side is `platform`.
 */
export const adminNavGroups: NavGroup[] = [
  {
    label: 'Clients',
    items: [
      {
        title: 'All clients',
        url: '/admin',
        icon: 'teams',
        isActive: false,
        shortcut: ['a', 'c'],
        items: []
      }
    ]
  },
  {
    label: 'Platform',
    items: [
      {
        title: 'Audit log',
        url: '/admin/audit',
        icon: 'post',
        isActive: false,
        shortcut: ['a', 'l'],
        items: []
      }
    ]
  }
];

/** The way into the admin side from the client shell. Only Kynetic staff are given this group. */
export const adminEntryGroup: NavGroup = {
  label: 'Kynetic',
  items: [
    {
      title: 'Admin',
      url: '/admin',
      icon: 'settings',
      isActive: false,
      shortcut: ['a', 'd'],
      items: []
    }
  ]
};
