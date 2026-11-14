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
      },
      {
        title: 'My systems',
        url: '/dashboard/systems',
        icon: 'settings',
        isActive: false,
        items: []
      },
      {
        title: 'Pipeline',
        url: '/dashboard/pipeline',
        icon: 'kanban',
        isActive: false,
        shortcut: ['p', 'p'],
        items: []
      },
      {
        title: 'Leads',
        url: '/dashboard/contacts',
        icon: 'teams',
        isActive: false,
        shortcut: ['l', 'l'],
        items: []
      },
      {
        title: 'Import leads',
        url: '/dashboard/import',
        icon: 'upload',
        isActive: false,
        access: { role: 'owner' },
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
      },
      {
        title: 'Appointments',
        url: '/dashboard/appointments',
        icon: 'calendar',
        isActive: false,
        module: 'crm',
        level: 'lite',
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
        title: 'Reports',
        url: '/dashboard/reports',
        icon: 'dashboard',
        isActive: false,
        items: []
      },
      {
        title: 'Support',
        url: '/dashboard/support',
        icon: 'help',
        isActive: false,
        items: []
      },
      {
        title: 'Documents',
        url: '/dashboard/documents',
        icon: 'post',
        isActive: false,
        items: []
      },
      {
        title: 'Online Presence',
        url: '/dashboard/presence',
        icon: 'dashboard',
        isActive: false,
        module: 'opm',
        items: []
      },
      {
        title: 'Reviews',
        url: '/dashboard/reviews',
        icon: 'exclusive',
        isActive: false,
        module: 'opm',
        items: []
      },
      {
        title: 'Referrals',
        url: '/dashboard/referrals',
        icon: 'teams',
        isActive: false,
        module: 'crm',
        level: 'full',
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
      },
      {
        title: 'Branding',
        url: '/dashboard/settings/branding',
        icon: 'settings',
        isActive: false,
        items: []
      },
      {
        title: 'Usage',
        url: '/dashboard/usage',
        icon: 'billing',
        isActive: false,
        access: { role: 'owner' },
        items: []
      }
    ]
  },
  {
    label: 'CRM',
    items: [
      {
        title: 'Companies',
        url: '/dashboard/companies',
        icon: 'teams',
        isActive: false,
        module: 'crm',
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
      },
      {
        title: 'Automations',
        url: '/dashboard/settings/automations',
        icon: 'settings',
        isActive: false,
        items: []
      }
    ]
  },
  {
    label: 'Settings',
    items: [
      {
        title: 'Custom fields',
        url: '/dashboard/settings/custom-fields',
        icon: 'settings',
        isActive: false,
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
    label: 'Agency',
    items: [
      {
        title: 'Agency workspace',
        url: '/admin/agency',
        icon: 'kanban',
        isActive: false,
        items: []
      }
    ]
  },
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
        title: 'Client portals',
        url: '/admin/portals',
        icon: 'user',
        isActive: false,
        shortcut: ['a', 'v'],
        items: []
      },
      {
        title: 'Onboard a client',
        url: '/admin/clients/new',
        icon: 'add',
        isActive: false,
        shortcut: ['a', 'n'],
        items: []
      },
      {
        title: 'Template library',
        url: '/admin/templates',
        icon: 'post',
        isActive: false,
        items: []
      },
      {
        title: 'System requests',
        url: '/admin/system-requests',
        icon: 'help',
        isActive: false,
        items: []
      },
      {
        title: 'Users',
        url: '/admin/users',
        icon: 'user',
        isActive: false,
        shortcut: ['a', 'u'],
        items: []
      }
    ]
  },
  {
    label: 'Platform',
    items: [
      {
        title: 'Backups',
        url: '/admin/backups',
        icon: 'post',
        isActive: false,
        items: []
      },
      {
        title: 'Archive',
        url: '/admin/archive',
        icon: 'post',
        isActive: false,
        items: []
      },
      {
        title: 'Audit log',
        url: '/admin/audit',
        icon: 'post',
        isActive: false,
        shortcut: ['a', 'l'],
        items: []
      },
      {
        title: 'Operations',
        url: '/admin/operations',
        icon: 'settings',
        isActive: false,
        shortcut: ['a', 'o'],
        items: []
      },
      {
        title: 'Usage',
        url: '/admin/usage',
        icon: 'billing',
        isActive: false,
        shortcut: ['a', 'g'],
        items: []
      },
      {
        title: 'Support requests',
        url: '/admin/support',
        icon: 'help',
        isActive: false,
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
