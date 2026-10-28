import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { listPresence, presenceReport, savePresenceItem, saveReviewSnapshot } from '@/server/presence';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import type { Actor } from '@/server/auth/permissions';

let testDb: TestDatabase;
let appDb: Db;
const admin: Actor = { userId: IDS.admin, kyneticRole: 'admin', membership: null, viewAs: { tenantId: IDS.tenantA, write: true } };
const adminCtx = { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' as const };
const item = { kind: 'profile' as const, title: 'Business profile', status: 'planned' as const };

beforeAll(async () => {
  testDb = await createTestDatabase();
  await seedTwoTenants(testDb.admin);
  appDb = createDb(testDb.app);
});
afterAll(async () => { await testDb?.drop(); });

describe('F-83 online presence tenant and module isolation', () => {
  it('denies access when off, retains records when disabled, and isolates tenants', async () => {
    await expect(listPresence(ctx.ownerA(), { db: appDb })).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
    await testDb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'opm', true), (${IDS.tenantB}, 'opm', true)`;
    await savePresenceItem(adminCtx, admin, item, undefined, { db: appDb });
    expect((await listPresence(ctx.ownerA(), { db: appDb })).items).toHaveLength(1);
    expect((await listPresence(ctx.ownerB(), { db: appDb })).items).toHaveLength(0);
    await testDb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'opm'`;
    await expect(listPresence(ctx.ownerA(), { db: appDb })).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
    await testDb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'opm'`;
    expect((await listPresence(ctx.ownerA(), { db: appDb })).items).toHaveLength(1);
  });
  it('refuses owner writes', async () => {
    const owner: Actor = { userId: IDS.ownerA, kyneticRole: null, membership: { tenantId: IDS.tenantA, role: 'owner', canExport: false, canBulkDelete: false }, viewAs: null };
    await expect(savePresenceItem(ctx.ownerA(), owner, item, undefined, { db: appDb })).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('includes only this tenant and month in review reports', async () => {
    await saveReviewSnapshot(adminCtx, admin, { source: 'Google', capturedOn: '2026-10-10', reviewCount: 12, averageRating: 4.5 }, { db: appDb });
    await saveReviewSnapshot(adminCtx, admin, { source: 'Google', capturedOn: '2026-11-10', reviewCount: 13, averageRating: 4.6 }, { db: appDb });
    const october = await presenceReport(ctx.ownerA(), '2026-10-01', { db: appDb });
    expect(october.snapshots).toHaveLength(1);
    expect(october.snapshots[0]).toMatchObject({ reviewCount: 12, averageRating: '4.50' });
    expect((await presenceReport(ctx.ownerB(), '2026-10-01', { db: appDb })).snapshots).toHaveLength(0);
  });
});
