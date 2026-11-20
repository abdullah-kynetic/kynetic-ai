import type { NavGroup } from '@/types';
import { adminAreas, clientAreas, vaHelpArea } from './area-nav';

/** One sidebar entry per business area. Sub-pages live in each area's horizontal tabs. */
export const navGroups: NavGroup[] = [
  {
    label: 'Workspace',
    items: clientAreas.map((area) => ({
      title: area.title,
      url: area.href,
      icon: area.icon,
      items: []
    }))
  }
];

export const adminNavGroups: NavGroup[] = [
  {
    label: 'Business',
    items: [
      ...adminAreas.map((area) => ({
        title: area.title,
        url: area.href,
        icon: area.icon,
        access: area.adminOnly ? { role: 'admin' } : undefined,
        items: []
      })),
      {
        title: vaHelpArea.title,
        url: vaHelpArea.href,
        icon: vaHelpArea.icon,
        access: { role: 'va' },
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
