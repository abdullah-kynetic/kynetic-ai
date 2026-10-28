import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { QUEUES } from '@/server/jobs';
import {
  listPresence,
  presenceReport,
  savePresenceItem,
  saveReviewSnapshot
} from '@/server/presence';
import { generateMonthlyReport } from '@/server/reports';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import type { Actor } from '@/server/auth/permissions';

let testDb: TestDatabase;
let appDb: Db;
const admin: Actor = {
  userId: IDS.admin,
  kyneticRole: 'admin',
  membership: null,
  viewAs: { tenantId: IDS.tenantA, write: true }
};
const adminCtx = { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' as const };
const item = { kind: 'profile' as const, title: 'Business profile', status: 'planned' as const };

beforeAll(async () => {
  testDb = await createTestDatabase({ jobs: true, jobQueues: QUEUES });
  await seedTwoTenants(testDb.admin);
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = testDb.urls.app;
  process.env.DATABASE_URL_AUTH = testDb.authUrl;
  process.env.DATABASE_URL_WORKER = testDb.urls.worker;
  process.env.BETTER_AUTH_SECRET = 'integration-only-secret-not-for-real-use';
  process.env.APP_ENCRYPTION_KEY = 'integration-only-encryption-key-not-real';
  appDb = createDb(testDb.app);
});
afterAll(async () => {
  await testDb?.drop();
});

describe('F-83 online presence tenant and module isolation', () => {
  it('denies access when off, retains records when disabled, and isolates tenants', async () => {
    await expect(listPresence(ctx.ownerA(), { db: appDb })).rejects.toMatchObject({
      code: 'MODULE_DISABLED'
    });
    await testDb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'opm', true), (${IDS.tenantB}, 'opm', true)`;
    await savePresenceItem(adminCtx, admin, item, undefined, { db: appDb });
    expect((await listPresence(ctx.ownerA(), { db: appDb })).items).toHaveLength(2);
    expect((await listPresence(ctx.ownerB(), { db: appDb })).items).toHaveLength(1);
    await testDb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'opm'`;
    await expect(listPresence(ctx.ownerA(), { db: appDb })).rejects.toMatchObject({
      code: 'MODULE_DISABLED'
    });
    await testDb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'opm'`;
    expect((await listPresence(ctx.ownerA(), { db: appDb })).items).toHaveLength(2);
  });
  it('refuses owner writes', async () => {
    const owner: Actor = {
      userId: IDS.ownerA,
      kyneticRole: null,
      membership: { tenantId: IDS.tenantA, role: 'owner', canExport: false, canBulkDelete: false },
      viewAs: null
    };
    await expect(
      savePresenceItem(ctx.ownerA(), owner, item, undefined, { db: appDb })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
  it('includes only this tenant and month in review reports', async () => {
    const snapshot = await saveReviewSnapshot(
      adminCtx,
      admin,
      { source: 'Google', capturedOn: '2026-10-10', reviewCount: 12, averageRating: 4.5 },
      { db: appDb }
    );
    await saveReviewSnapshot(
      adminCtx,
      admin,
      { source: 'Google', capturedOn: '2026-11-10', reviewCount: 13, averageRating: 4.6 },
      { db: appDb }
    );
    const october = await presenceReport(ctx.ownerA(), '2026-10-01', { db: appDb });
    expect(october.snapshots).toHaveLength(1);
    expect(october.snapshots[0]).toMatchObject({ reviewCount: 12, averageRating: '4.50' });
    expect(
      (await presenceReport(ctx.ownerB(), '2026-10-01', { db: appDb })).snapshots
    ).toHaveLength(0);
    const audit =
      await testDb.admin`select action, actor_user_id from audit_log where entity_id = ${snapshot.id}`;
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'presence.review_snapshot',
      actor_user_id: IDS.admin
    });
  });

  it('adds the enabled module data to the monthly report artifact sections', async () => {
    await testDb.admin`insert into tenant_modules (tenant_id, module_key, enabled)
      values (${IDS.tenantA}, 'opm', true) on conflict (tenant_id, module_key) do update set enabled = true`;
    await saveReviewSnapshot(
      adminCtx,
      admin,
      {
        source: 'Google',
        capturedOn: '2026-08-14',
        reviewCount: 23,
        averageRating: 4.7
      },
      { db: appDb }
    );

    const result = await generateMonthlyReport(ctx.ownerA(), '2026-08-01', { db: appDb });
    expect(result.sections.online_presence).toMatchObject({
      title: 'Online Presence',
      data: {
        snapshots: [
          { source: 'Google', capturedOn: '2026-08-14', reviewCount: 23, averageRating: '4.70' }
        ]
      }
    });
  });
});
