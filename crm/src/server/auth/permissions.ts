// The deny-by-default permission matrix (SECURITY 2.2, F-73). A cell that is not listed as allowed is
// a denial. Pure functions: no database, no clock, so every row is a cheap table-driven test.

export type KyneticRole = 'admin' | 'va';
export type TenantRole = 'owner' | 'staff';

/** What the server knows about the caller, built from the database on each request. */
export type Actor = {
  userId: string;
  kyneticRole: KyneticRole | null;
  /** The caller's membership in the tenant the request is about, if any. */
  membership: {
    tenantId: string;
    role: TenantRole;
    canExport: boolean;
    canBulkDelete: boolean;
  } | null;
  /** An active view-as session for a Kynetic user (F-57). */
  viewAs: { tenantId: string; write: boolean } | null;
};

type Cell = boolean | 'viewAs' | 'toggle';
type Row = {
  admin: Cell;
  va: Cell;
  owner: Cell;
  staff: Cell;
  toggle?: 'canExport' | 'canBulkDelete';
  write?: boolean;
};

const Y = true;
const N = false;

/**
 * One entry per row of the SECURITY 2.2 matrix. `viewAs` means the Kynetic user reaches tenant data
 * only inside a view-as session (read-only for VA; admin may switch to write per session). `toggle`
 * is a per-membership flag the owner can turn on for staff.
 */
export const MATRIX = {
  'tenant_data.read': { admin: 'viewAs', va: 'viewAs', owner: Y, staff: Y },
  'tenant_data.write': { admin: 'viewAs', va: N, owner: Y, staff: Y, write: true },
  'calls.read': { admin: Y, va: 'viewAs', owner: Y, staff: Y },
  'calls.flag': { admin: Y, va: Y, owner: Y, staff: Y },
  'calls.cost.read': { admin: Y, va: Y, owner: N, staff: N },
  'bulk.edit': { admin: Y, va: N, owner: Y, staff: Y, write: true },
  'bulk.delete': {
    admin: Y,
    va: N,
    owner: Y,
    staff: 'toggle',
    toggle: 'canBulkDelete',
    write: true
  },
  'export.csv': { admin: Y, va: N, owner: Y, staff: 'toggle', toggle: 'canExport' },
  'import.onboarding': { admin: Y, va: N, owner: N, staff: N, write: true },
  // P1-5: a client's owner imports their own contact list (CSV or Excel). Contacts only.
  'import.self': { admin: N, va: N, owner: Y, staff: N, write: true },
  'team.manage': { admin: Y, va: N, owner: Y, staff: N, write: true },
  'settings.business': { admin: Y, va: N, owner: Y, staff: N, write: true },
  'alex.settings.client': { admin: Y, va: N, owner: Y, staff: N, write: true },
  'alex.pause_and_hours': { admin: Y, va: N, owner: Y, staff: Y, write: true },
  'alex.prompt.manage': { admin: Y, va: N, owner: N, staff: N, write: true },
  'automations.toggle': { admin: Y, va: N, owner: Y, staff: N, write: true },
  // P6-S6: a client owner proposes new cadence and copy; only a Kynetic admin approves it.
  'automations.edit': { admin: Y, va: N, owner: Y, staff: N, write: true },
  'automations.approve': { admin: Y, va: N, owner: N, staff: N, write: true },
  'modules.manage': { admin: Y, va: N, owner: N, staff: N, write: true },
  'notifications.own': { admin: Y, va: Y, owner: Y, staff: Y },
  'admin.clients.read': { admin: Y, va: Y, owner: N, staff: N },
  'admin.onboard': { admin: Y, va: N, owner: N, staff: N, write: true },
  'viewas.start': { admin: Y, va: Y, owner: N, staff: N },
  'users.cross_tenant.manage': { admin: Y, va: N, owner: N, staff: N, write: true },
  'users.client.invite_reset': { admin: Y, va: Y, owner: N, staff: N, write: true },
  'audit.read': { admin: Y, va: Y, owner: N, staff: N },
  'backups.read': { admin: Y, va: Y, owner: N, staff: N },
  'backups.run': { admin: Y, va: N, owner: N, staff: N, write: true },
  'billing.manage': { admin: Y, va: N, owner: N, staff: N, write: true },
  'tenant.delete': { admin: Y, va: N, owner: N, staff: N, write: true },
  'admin_accounts.manage': { admin: Y, va: N, owner: N, staff: N, write: true },
  // M20-06: staff triage client support requests. VA may work the queue; clients only submit and read their own.
  'support.manage': { admin: Y, va: Y, owner: N, staff: N, write: true }
} as const satisfies Record<string, Row>;

export type Action = keyof typeof MATRIX;

/** Actions that stay closed to everyone during view-as (SECURITY 2.6), whatever the matrix says. */
const NEVER_IN_VIEW_AS = new Set<Action>([
  'export.csv',
  'team.manage',
  'modules.manage',
  'billing.manage',
  'alex.prompt.manage',
  'users.cross_tenant.manage',
  'users.client.invite_reset',
  'admin_accounts.manage',
  'tenant.delete'
]);

function cellFor(actor: Actor, row: Row, tenantId: string | undefined): Cell {
  const m = actor.membership;
  // Tenant roles apply only to the tenant their membership is for.
  const tenantOk = tenantId === undefined || (m !== null && m.tenantId === tenantId);
  if (m && tenantOk) return row[m.role];
  if (actor.kyneticRole) return row[actor.kyneticRole];
  return false;
}

/** Pure decision. Unknown actions, missing membership and a foreign tenant all deny. */
export function can(actor: Actor, action: Action, tenantId?: string): boolean {
  const row: Row | undefined = MATRIX[action];
  if (!row) return false;
  const cell = cellFor(actor, row, tenantId);
  const m = actor.membership;
  const asTenantMember = m !== null && (tenantId === undefined || m.tenantId === tenantId);

  if (cell === 'toggle') return Boolean(asTenantMember && m && row.toggle && m[row.toggle]);
  if (cell === 'viewAs') {
    if (asTenantMember) return false;
    const v = actor.viewAs;
    if (!v || (tenantId !== undefined && v.tenantId !== tenantId)) return false;
    if (row.write) return actor.kyneticRole === 'admin' && v.write;
    return true;
  }
  if (cell !== true) return false;

  // Inside a view-as session the Kynetic user acts on the client: writes need write mode and a few
  // actions are never allowed.
  if (actor.viewAs && !asTenantMember && actor.kyneticRole) {
    if (NEVER_IN_VIEW_AS.has(action)) return false;
    if (row.write && !actor.viewAs.write) return false;
  }
  return true;
}
