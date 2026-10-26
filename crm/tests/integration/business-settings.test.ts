import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import type { Actor } from '@/server/auth/permissions';
import {
  getBusinessSettings,
  inviteStaff,
  listTeam,
  removeStaff,
  revokeInvite,
  setStaffPermissions,
  updateBusinessSettings
} from '@/server/settings';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

const actor = (tenantId: string, userId: string, role: 'owner' | 'staff'): Actor => ({
  userId,
  kyneticRole: null,
  membership: { tenantId, role, canExport: false, canBulkDelete: false },
  viewAs: null
});
const ownerA = actor(IDS.tenantA, IDS.ownerA, 'owner');
const staffA = actor(IDS.tenantA, IDS.staffA, 'staff');
const ownerB = actor(IDS.tenantB, IDS.ownerB, 'owner');
const opts = () => ({ db });

const hours = { mon: [{ open: '08:00', close: '17:00' }] };

describe('F-41 business settings', () => {
  it('owner saves hours, area, services and transfer number, and reads them back', async () => {
    const saved = await updateBusinessSettings(
      ctx.ownerA(),
      ownerA,
      {
        businessHours: hours,
        serviceArea: { type: 'zips', zips: ['90210'] },
        services: ['Roof repair'],
        transferNumber: '+15555550123'
      },
      opts()
    );
    expect(saved.transferNumber).toBe('+15555550123');
    expect(await getBusinessSettings(ctx.ownerA(), opts())).toMatchObject({
      businessHours: hours,
      services: ['Roof repair']
    });
  });

  it('writes an audit row with before and after', async () => {
    const rows = await tdb.admin`select action, before, after from audit_log
      where tenant_id = ${IDS.tenantA} and action = 'settings.business.update'`;
    expect(rows).toHaveLength(1);
    expect(rows[0].after.services).toEqual(['Roof repair']);
    expect(rows[0].before.services).toEqual([]);
  });

  it('staff can read but cannot write (403)', async () => {
    await expect(getBusinessSettings(ctx.staffA(), opts())).resolves.toBeTruthy();
    await expect(
      updateBusinessSettings(ctx.staffA(), staffA, { services: ['x'] }, opts())
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('refuses fields outside the allow-list and bad values; nothing is written', async () => {
    for (const bad of [
      { plan: 'value' },
      { transferNumber: '555' },
      { businessHours: { mon: [{ open: '9', close: '5' }] } }
    ]) {
      await expect(updateBusinessSettings(ctx.ownerA(), ownerA, bad, opts())).rejects.toMatchObject(
        {
          code: 'VALIDATION_FAILED'
        }
      );
    }
    const [t] = await tdb.admin`select plan from tenants where id = ${IDS.tenantA}`;
    expect(t.plan).toBe('founding');
  });

  it("an owner cannot change another tenant's settings", async () => {
    await expect(
      updateBusinessSettings(ctx.ownerB(), ownerA, { services: ['x'] }, opts())
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const [b] = await tdb.admin`select services from tenants where id = ${IDS.tenantB}`;
    expect(b.services).toEqual([]);
  });
});

describe('F-41 team settings', () => {
  it('staff opening team settings is refused (403)', async () => {
    await expect(listTeam(ctx.staffA(), staffA, opts())).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(
      inviteStaff(ctx.staffA(), staffA, { email: 'new@example.test' }, opts())
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('owner lists members and open invites for their own tenant only', async () => {
    const t = await listTeam(ctx.ownerA(), ownerA, opts());
    expect(t.members.map((m) => m.email).toSorted()).toEqual([
      'owner-a@example.test',
      'staff-a@example.test'
    ]);
    expect(t.invites.map((i) => i.email)).toEqual(['invitee-a@example.test']);
  });

  it('invite stores only a token hash, rejects duplicates and existing members', async () => {
    const inv = await inviteStaff(ctx.ownerA(), ownerA, { email: 'New@Example.test' }, opts());
    const [row] =
      await tdb.admin`select email, role, token_hash from invitations where id = ${inv.id}`;
    expect(row.email).toBe('new@example.test');
    expect(row.role).toBe('staff');
    expect(row.token_hash).not.toBe(inv.token);
    await expect(
      inviteStaff(ctx.ownerA(), ownerA, { email: 'new@example.test' }, opts())
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      inviteStaff(ctx.ownerA(), ownerA, { email: 'staff-a@example.test' }, opts())
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await revokeInvite(ctx.ownerA(), ownerA, inv.id, opts());
    expect(
      (await listTeam(ctx.ownerA(), ownerA, opts())).invites.map((i) => i.email)
    ).not.toContain('new@example.test');
  });

  it('owner toggles staff permissions, audited; cannot target an owner', async () => {
    await setStaffPermissions(ctx.ownerA(), ownerA, IDS.staffA, { canExport: true }, opts());
    const [m] = await tdb.admin`select can_export from memberships where user_id = ${IDS.staffA}`;
    expect(m.can_export).toBe(true);
    await expect(
      setStaffPermissions(ctx.ownerA(), ownerA, IDS.ownerA, { canExport: true }, opts())
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const [{ n }] =
      await tdb.admin`select count(*)::int n from audit_log where action = 'team.permissions'`;
    expect(n).toBe(1);
  });

  it("an owner cannot remove another tenant's staff or any owner; can remove own staff", async () => {
    await expect(removeStaff(ctx.ownerB(), ownerB, IDS.staffA, opts())).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(removeStaff(ctx.ownerA(), ownerA, IDS.ownerA, opts())).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await removeStaff(ctx.ownerA(), ownerA, IDS.staffA, opts());
    const [{ n }] =
      await tdb.admin`select count(*)::int n from memberships where user_id = ${IDS.staffA}`;
    expect(n).toBe(0);
  });
});
