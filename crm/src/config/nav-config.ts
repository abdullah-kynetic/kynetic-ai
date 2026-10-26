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
      },
      {
        title: 'View as client',
        url: '/admin/view-as',
        icon: 'user',
        isActive: false,
        shortcut: ['a', 'v'],
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
