/** Area navigation is the single map for sidebar destinations and in-page tabs. */
export type AreaTab = { label: string; href: string };
export type Area = {
  title: string;
  href: string;
  icon: 'dashboard' | 'teams' | 'kanban' | 'billing' | 'settings' | 'help' | 'phone';
  description: string;
  tabs: readonly AreaTab[];
  adminOnly?: boolean;
};

export const adminAreas: readonly Area[] = [
  {
    title: 'Today',
    href: '/admin',
    icon: 'dashboard',
    description: 'The work that needs attention today',
    tabs: []
  },
  {
    title: 'Clients',
    href: '/admin/clients',
    icon: 'teams',
    description: 'Client lifecycle and operations',
    tabs: [
      { label: 'Board', href: '/admin/clients' },
      { label: 'Live', href: '/admin/clients/live' },
      { label: 'Demo', href: '/admin/clients/demo' },
      { label: 'Churned', href: '/admin/clients/churned' },
      { label: 'Operations', href: '/admin/clients/operations' }
    ]
  },
  {
    title: 'Prospecting',
    href: '/admin/prospecting',
    icon: 'teams',
    description: 'From new prospects to qualified leads',
    adminOnly: true,
    tabs: [
      { label: 'Funnel', href: '/admin/prospecting' },
      { label: 'Scraped leads', href: '/admin/prospecting/scraped' },
      { label: 'Half-enriched', href: '/admin/prospecting/half-enriched' },
      { label: 'Fully enriched', href: '/admin/prospecting/fully-enriched' },
      { label: 'Campaigns', href: '/admin/prospecting/campaigns' },
      { label: 'Human dialer', href: '/admin/prospecting/dialer' }
    ]
  },
  {
    title: 'Sales',
    href: '/admin/sales',
    icon: 'kanban',
    description: 'Deals from audit to decision',
    adminOnly: true,
    tabs: [
      { label: 'Pipeline', href: '/admin/sales' },
      { label: 'Inbox', href: '/admin/sales/inbox' },
      { label: 'Compose', href: '/admin/sales/compose' },
      { label: 'Free audits', href: '/admin/sales/audits' },
      { label: 'Proposals', href: '/admin/sales/proposals' },
      { label: 'Contracts', href: '/admin/sales/contracts' }
    ]
  },
  {
    title: 'Money',
    href: '/admin/money',
    icon: 'billing',
    description: 'Revenue, cash collection and invoices',
    adminOnly: true,
    tabs: [
      { label: 'Overview', href: '/admin/money' },
      { label: 'Finance', href: '/admin/money/finance' },
      { label: 'Billing', href: '/admin/money/billing' },
      { label: 'Invoices', href: '/admin/money/invoices' },
      { label: 'Usage', href: '/admin/money/usage' }
    ]
  },
  {
    title: 'Settings',
    href: '/admin/settings',
    icon: 'settings',
    description: 'Account, team, integrations and system tools',
    tabs: [
      { label: 'Account', href: '/admin/settings' },
      { label: 'Team', href: '/admin/settings/team' },
      { label: 'Integrations', href: '/admin/settings/integrations' },
      { label: 'Build', href: '/admin/settings/build' },
      { label: 'System', href: '/admin/settings/system' }
    ]
  }
];

/** VA support area; admin-only business areas remain hidden from VA navigation. */
export const vaHelpArea: Area = {
  title: 'Help',
  href: '/admin/help',
  icon: 'help',
  description: 'Client support and system requests',
  tabs: [
    { label: 'Support', href: '/admin/help' },
    { label: 'System requests', href: '/admin/help/system-requests' }
  ]
};

export const clientAreas: readonly Area[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: 'dashboard',
    description: 'Your business at a glance',
    tabs: []
  },
  {
    title: 'Leads',
    href: '/dashboard/leads',
    icon: 'teams',
    description: 'Contacts, deals and tasks',
    tabs: [
      { label: 'Overview', href: '/dashboard/leads' },
      { label: 'Contacts', href: '/dashboard/leads/contacts' },
      { label: 'Pipeline', href: '/dashboard/leads/pipeline' },
      { label: 'Import', href: '/dashboard/leads/import' },
      { label: 'Companies', href: '/dashboard/leads/companies' },
      { label: 'Tasks', href: '/dashboard/leads/tasks' }
    ]
  },
  {
    title: 'Calls & Bookings',
    href: '/dashboard/bookings',
    icon: 'phone',
    description: 'Calls, appointments and messages',
    tabs: [
      { label: 'Overview', href: '/dashboard/bookings' },
      { label: 'Calls', href: '/dashboard/bookings/calls' },
      { label: 'Appointments', href: '/dashboard/bookings/appointments' },
      { label: 'Messages', href: '/dashboard/bookings/messages' }
    ]
  },
  {
    title: 'Reputation',
    href: '/dashboard/reputation',
    icon: 'kanban',
    description: 'Reviews, referrals and online presence',
    tabs: [
      { label: 'Overview', href: '/dashboard/reputation' },
      { label: 'Reviews', href: '/dashboard/reputation/reviews' },
      { label: 'Referrals', href: '/dashboard/reputation/referrals' },
      { label: 'Online presence', href: '/dashboard/reputation/presence' }
    ]
  },
  {
    title: 'Settings',
    href: '/dashboard/settings',
    icon: 'settings',
    description: 'Your account and system preferences',
    tabs: [
      { label: 'Account', href: '/dashboard/settings' },
      { label: 'Team', href: '/dashboard/settings/team' },
      { label: 'Branding', href: '/dashboard/settings/branding' },
      { label: 'Pipeline', href: '/dashboard/settings/pipeline' },
      { label: 'Tags', href: '/dashboard/settings/tags' },
      { label: 'Notifications', href: '/dashboard/settings/notifications' },
      { label: 'Automations', href: '/dashboard/settings/automations' },
      { label: 'Custom fields', href: '/dashboard/settings/custom-fields' },
      { label: 'Alex', href: '/dashboard/settings/alex' },
      { label: 'My systems', href: '/dashboard/settings/systems' }
    ]
  },
  {
    title: 'Help',
    href: '/dashboard/help',
    icon: 'help',
    description: 'Support, documents and reports',
    tabs: [
      { label: 'Support', href: '/dashboard/help' },
      { label: 'Documents', href: '/dashboard/help/documents' },
      { label: 'Reports', href: '/dashboard/help/reports' },
      { label: 'Usage', href: '/dashboard/help/usage' },
      { label: 'Notifications', href: '/dashboard/help/notifications' }
    ]
  }
];
