import { NavGroup } from '@/types';

/**
 * Sidebar and Cmd+K navigation. M0-13 replaces this with the module-aware
 * nav registry; until then the shell has one placeholder entry.
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
