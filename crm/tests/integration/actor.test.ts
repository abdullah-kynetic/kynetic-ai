import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  authorize,
  ForbiddenError,
  requireKynetic,
  requireRole,
  resolveActor
} from '@/server/auth';
import { createDb } from '@/server/db/client';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
});
afterAll(async () => {
  await db?.drop();
});

const authDb = () => createDb(db.auth);
const user = (id: string, kyneticRole: 'admin' | 'va' | null = null) => ({ id, kyneticRole });

describe('M0-11 resolveActor reads the membership from the database', () => {
  it('returns the membership for the requested tenant', async () => {
    const a = await resolveActor(user(IDS.ownerA), IDS.tenantA, { db: authDb() });
    expect(a.membership).toMatchObject({ tenantId: IDS.tenantA, role: 'owner' });
    expect(() => authorize(a, 'team.manage', IDS.tenantA)).not.toThrow();
  });

  it('a tenant id the user is not a member of counts for nothing', async () => {
    const a = await resolveActor(user(IDS.ownerA), IDS.tenantB, { db: authDb() });
    expect(a.membership).toBeNull();
    expect(() => authorize(a, 'tenant_data.read', IDS.tenantB)).toThrow(ForbiddenError);
  });

  it('staff export and bulk delete follow the stored toggles', async () => {
    const before = await resolveActor(user(IDS.staffA), IDS.tenantA, { db: authDb() });
    expect(() => authorize(before, 'export.csv', IDS.tenantA)).toThrow(ForbiddenError);
    await db.admin`update memberships set can_export = true where user_id = ${IDS.staffA}`;
    const after = await resolveActor(user(IDS.staffA), IDS.tenantA, { db: authDb() });
    expect(() => authorize(after, 'export.csv', IDS.tenantA)).not.toThrow();
    expect(() => authorize(after, 'bulk.delete', IDS.tenantA)).toThrow(ForbiddenError);
  });

  it('a suspended tenant gives no membership', async () => {
    await db.admin`update tenants set status = 'suspended' where id = ${IDS.tenantB}`;
    const a = await resolveActor(user(IDS.ownerB), IDS.tenantB, { db: authDb() });
    expect(a.membership).toBeNull();
  });

  it('Kynetic staff have no membership and need view-as for tenant data', async () => {
    const a = await resolveActor(user(IDS.admin, 'admin'), IDS.tenantA, { db: authDb() });
    expect(a.membership).toBeNull();
    expect(() => authorize(a, 'tenant_data.read', IDS.tenantA)).toThrow(ForbiddenError);
    const v = await resolveActor(user(IDS.admin, 'admin'), IDS.tenantA, {
      db: authDb(),
      viewAs: { tenantId: IDS.tenantA, write: false }
    });
    expect(() => authorize(v, 'tenant_data.read', IDS.tenantA)).not.toThrow();
  });

  it('kynetic_auth sees only the membership and tenant columns it was granted', async () => {
    await expect(db.auth`select name from tenants limit 1`).rejects.toThrow(/permission denied/);
    await expect(db.auth`select invited_by from invitations limit 1`).rejects.toThrow(
      /permission denied/
    );
  });
});

describe('M0-11 role guards', () => {
  it('requireRole accepts listed roles and refuses the rest', () => {
    expect(() => requireRole({ role: 'owner' }, ['owner', 'staff'])).not.toThrow();
    expect(() => requireRole({ role: 'va' }, ['owner', 'staff'])).toThrow(ForbiddenError);
  });

  it('requireKynetic refuses client users and the wrong Kynetic role', () => {
    expect(() => requireKynetic({ kyneticRole: null })).toThrow(ForbiddenError);
    expect(() => requireKynetic({ kyneticRole: 'va' }, 'admin')).toThrow(ForbiddenError);
    expect(() => requireKynetic({ kyneticRole: 'admin' }, 'admin')).not.toThrow();
    expect(() => requireKynetic({ kyneticRole: 'va' })).not.toThrow();
  });
});
