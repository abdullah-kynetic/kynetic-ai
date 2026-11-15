import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { getTodayData } from '@/server/admin';
import { createDb, type Db } from '@/server/db/client';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let test: TestDatabase;
let db: Db;

beforeAll(async () => {
  test = await createTestDatabase();
  await seedTwoTenants(test.admin);
  db = createDb(test.app);
});

afterAll(async () => {
  await test?.drop();
});

describe('admin Today data', () => {
  it('does not put admin-only data in a VA response', async () => {
    const admin = await getTodayData({ userId: IDS.admin, role: 'admin' }, { db });
    const va = await getTodayData({ userId: IDS.va, role: 'va' }, { db });
    expect(admin.needsYouNow).not.toBeNull();
    expect(admin.salesToday).not.toBeNull();
    expect(admin.dailySummary).not.toBeNull();
    expect(va.needsYouNow).toBeNull();
    expect(va.salesToday).toBeNull();
    expect(va.dailySummary).toBeNull();
    expect(va.clientsNeedingAttention).toBeDefined();
    expect(va.support).toBeDefined();
  });
});
