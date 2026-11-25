import type { NavGroup } from '@/types';

/** Sidebar while a client's portal is being built or tested: progress first, then help and settings. */
export const buildNavGroups: NavGroup[] = [
  {
    label: 'Your build',
    items: [
      {
        title: 'Build progress',
        url: '/dashboard/build',
        icon: 'dashboard',
        items: []
      },
      { title: 'Help', url: '/dashboard/help', icon: 'help', items: [] },
      {
        title: 'Settings',
        url: '/dashboard/settings',
        icon: 'settings',
        items: []
      }
    ]
  }
];
