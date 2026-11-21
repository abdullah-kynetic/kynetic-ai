import { SERVICE_TOKEN_SCOPES } from './scopes';

type ServiceTokenScope = (typeof SERVICE_TOKEN_SCOPES)[number];

/** Plain-language groups for the owner's tick-box page. Every scope sits in exactly one group. */
export const SCOPE_GROUPS: {
  id: string;
  label: string;
  hint: string;
  scopes: ServiceTokenScope[];
}[] = [
  {
    id: 'contacts',
    label: 'Contacts and leads',
    hint: 'See people, add a new lead, record a contact decision.',
    scopes: [
      'contacts:read',
      'contacts:write',
      'contacts:delete',
      'contacts:export',
      'create-contact',
      'contact-decisions:write',
      'contact-policy:read'
    ]
  },
  {
    id: 'companies',
    label: 'Companies',
    hint: 'See companies and their contacts and deals, add or edit a company.',
    scopes: ['companies:read', 'companies:write']
  },
  {
    id: 'deals',
    label: 'Deals',
    hint: 'See deals and move them between stages.',
    scopes: ['deals:read', 'deals:write', 'update-deal-stage', 'pipeline:write']
  },
  {
    id: 'tasks-notes',
    label: 'Tasks and notes',
    hint: 'See and create tasks, add notes.',
    scopes: ['tasks:read', 'tasks:write', 'notes:write']
  },
  {
    id: 'messages',
    label: 'Messages',
    hint: 'Read contact message threads. Sending is not offered yet.',
    scopes: ['messages:read']
  },
  {
    id: 'calls',
    label: 'Calls',
    hint: 'See call history and log call results.',
    scopes: ['calls:read', 'calls:write', 'calls:recording', 'call-log:write']
  },
  {
    id: 'appointments',
    label: 'Appointments',
    hint: 'See and book appointments.',
    scopes: ['appointments:read', 'appointments:write']
  },
  {
    id: 'reporting',
    label: 'Reports and settings (read only)',
    hint: 'See client details, numbers and send state.',
    scopes: ['tenant:read', 'metrics:read', 'send-state:read', 'reputation:read']
  },
  {
    id: 'referrals',
    label: 'Referrals',
    hint: 'See and add client referrals, and update their status. Reward amounts stay with the owner.',
    scopes: ['referrals:write']
  },
  {
    id: 'automation',
    label: 'Automation plumbing',
    hint: 'Acknowledge events from the portal.',
    scopes: ['event-ack']
  }
];

const READ_ONLY = SERVICE_TOKEN_SCOPES.filter(
  (s) => s.endsWith(':read') || s === 'contact-policy:read' || s === 'send-state:read'
);

export const SCOPE_PRESETS: { id: string; label: string; scopes: ServiceTokenScope[] }[] = [
  { id: 'read-only', label: 'Read only', scopes: [...READ_ONLY] },
  {
    id: 'sales-agent',
    label: 'Sales agent',
    scopes: [
      ...READ_ONLY,
      'create-contact',
      'contacts:write',
      'update-deal-stage',
      'deals:write',
      'tasks:write',
      'notes:write',
      'calls:write',
      'call-log:write',
      'appointments:write',
      'contact-decisions:write'
    ]
  },
  { id: 'everything', label: 'Everything', scopes: [...SERVICE_TOKEN_SCOPES] }
];
