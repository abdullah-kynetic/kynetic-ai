import { describe, expect, it } from 'vitest';
import { can, MATRIX, type Action, type Actor } from '@/server/auth/permissions';

const T = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const base = { userId: 'u', kyneticRole: null, membership: null, viewAs: null } satisfies Actor;
const owner: Actor = {
  ...base,
  membership: { tenantId: T, role: 'owner', canExport: false, canBulkDelete: false }
};
const staff = (flags: { canExport?: boolean; canBulkDelete?: boolean } = {}): Actor => ({
  ...base,
  membership: { tenantId: T, role: 'staff', canExport: false, canBulkDelete: false, ...flags }
});
const admin: Actor = { ...base, kyneticRole: 'admin' };
const va: Actor = { ...base, kyneticRole: 'va' };
const adminViewAs = (write = false): Actor => ({ ...admin, viewAs: { tenantId: T, write } });
const vaViewAs: Actor = { ...va, viewAs: { tenantId: T, write: false } };

type Expect = { admin: boolean; va: boolean; owner: boolean; staff: boolean };

// One expectation per matrix row, written out here rather than derived from MATRIX so a typo in the
// matrix cannot hide itself. Tenant-scoped actions are asked with the tenant id; the Kynetic columns
// are asked outside view-as unless the row says otherwise.
const EXPECTED: Record<Action, Expect> = {
  'tenant_data.read': { admin: false, va: false, owner: true, staff: true },
  'tenant_data.write': { admin: false, va: false, owner: true, staff: true },
  'calls.read': { admin: true, va: false, owner: true, staff: true },
  'calls.flag': { admin: true, va: true, owner: true, staff: true },
  'calls.cost.read': { admin: true, va: true, owner: false, staff: false },
  'bulk.edit': { admin: true, va: false, owner: true, staff: true },
  'bulk.delete': { admin: true, va: false, owner: true, staff: false },
  'export.csv': { admin: true, va: false, owner: true, staff: false },
  'import.onboarding': { admin: true, va: false, owner: false, staff: false },
  'team.manage': { admin: true, va: false, owner: true, staff: false },
  'settings.business': { admin: true, va: false, owner: true, staff: false },
  'alex.settings.client': { admin: true, va: false, owner: true, staff: false },
  'alex.pause_and_hours': { admin: true, va: false, owner: true, staff: true },
  'alex.prompt.manage': { admin: true, va: false, owner: false, staff: false },
  'automations.toggle': { admin: true, va: false, owner: true, staff: false },
  'modules.manage': { admin: true, va: false, owner: false, staff: false },
  'notifications.own': { admin: true, va: true, owner: true, staff: true },
  'admin.clients.read': { admin: true, va: true, owner: false, staff: false },
  'admin.onboard': { admin: true, va: false, owner: false, staff: false },
  'viewas.start': { admin: true, va: true, owner: false, staff: false },
  'users.cross_tenant.manage': { admin: true, va: false, owner: false, staff: false },
  'users.client.invite_reset': { admin: true, va: true, owner: false, staff: false },
  'audit.read': { admin: true, va: true, owner: false, staff: false },
  'backups.read': { admin: true, va: true, owner: false, staff: false },
  'backups.run': { admin: true, va: false, owner: false, staff: false },
  'billing.manage': { admin: true, va: false, owner: false, staff: false },
  'tenant.delete': { admin: true, va: false, owner: false, staff: false },
  'admin_accounts.manage': { admin: true, va: false, owner: false, staff: false }
};

describe('F-73 permissions matrix, one test per row', () => {
  it('the expectation table covers exactly the matrix rows', () => {
    expect(Object.keys(EXPECTED).sort()).toEqual(Object.keys(MATRIX).sort());
  });

  for (const action of Object.keys(EXPECTED) as Action[]) {
    it(action, () => {
      const e = EXPECTED[action];
      expect(can(admin, action, T), 'admin').toBe(e.admin);
      expect(can(va, action, T), 'va').toBe(e.va);
      expect(can(owner, action, T), 'owner').toBe(e.owner);
      expect(can(staff(), action, T), 'staff').toBe(e.staff);
      expect(can(base, action, T), 'no role').toBe(false);
    });
  }
});

describe('F-73 toggles, tenant scope and view-as', () => {
  it('staff export and bulk delete follow the owner toggles', () => {
    expect(can(staff({ canExport: true }), 'export.csv', T)).toBe(true);
    expect(can(staff({ canExport: true }), 'bulk.delete', T)).toBe(false);
    expect(can(staff({ canBulkDelete: true }), 'bulk.delete', T)).toBe(true);
    expect(can(staff({ canBulkDelete: true }), 'export.csv', T)).toBe(false);
  });

  it('a tenant role never reaches another tenant', () => {
    expect(can(owner, 'tenant_data.read', OTHER)).toBe(false);
    expect(can(staff({ canExport: true }), 'export.csv', OTHER)).toBe(false);
  });

  it('Kynetic staff reach tenant data only inside view-as, VA read-only', () => {
    expect(can(admin, 'tenant_data.read', T)).toBe(false);
    expect(can(adminViewAs(), 'tenant_data.read', T)).toBe(true);
    expect(can(adminViewAs(), 'tenant_data.write', T)).toBe(false);
    expect(can(adminViewAs(true), 'tenant_data.write', T)).toBe(true);
    expect(can(vaViewAs, 'tenant_data.read', T)).toBe(true);
    expect(can(vaViewAs, 'tenant_data.write', T)).toBe(false);
    expect(can(vaViewAs, 'calls.read', T)).toBe(true);
  });

  it('view-as is bound to its tenant', () => {
    expect(can(adminViewAs(true), 'tenant_data.write', OTHER)).toBe(false);
  });

  it('view-as cannot export, change users, modules, billing or the prompt, even in write mode', () => {
    const a = adminViewAs(true);
    for (const x of [
      'export.csv',
      'team.manage',
      'modules.manage',
      'billing.manage',
      'alex.prompt.manage',
      'users.cross_tenant.manage',
      'admin_accounts.manage'
    ] as const) {
      expect(can(a, x, T), x).toBe(false);
    }
  });

  it('view-as in read mode blocks writes the admin could otherwise make', () => {
    expect(can(adminViewAs(false), 'bulk.edit', T)).toBe(false);
    expect(can(adminViewAs(true), 'bulk.edit', T)).toBe(true);
  });

  it('an unknown action is denied', () => {
    expect(can(admin, 'nope' as Action, T)).toBe(false);
  });
});
