import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listClientLifecycle, moveClientLifecycle } from '@/server/admin';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createDb } from '@/server/db/client';
import type { Db } from '@/server/db/client';

let t: TestDatabase;
let db: Db;
const admin = { userId: IDS.admin, role: 'admin' as const };

beforeAll(async () => {
  t = await createTestDatabase({ jobs: false });
  await seedTwoTenants(t.admin);
  db = createDb(t.app);
});
afterAll(async () => {
  await t?.drop();
});

describe('client lifecycle board data', () => {
  it('lists the stages saved by the fixtures', async () => {
    const saved = await listClientLifecycle(admin, { db });
    expect(saved.has(IDS.tenantA) && saved.has(IDS.tenantB)).toBe(true);
  });

  it('saves a stage and appends an audit row with before and after', async () => {
    await moveClientLifecycle(admin, IDS.tenantA, 'live', { db });
    await moveClientLifecycle(admin, IDS.tenantA, 'at_risk', { db });
    expect((await listClientLifecycle(admin, { db })).get(IDS.tenantA)).toBe('at_risk');
    const rows = await t.admin`select actor_user_id, before, after from audit_log
      where action = 'client_lifecycle.move' and entity_id = ${IDS.tenantA} order by created_at`;
    expect(rows).toHaveLength(2);
    expect(rows[1]!.before).toEqual({ stage: 'live' });
    expect(rows[1]!.after).toEqual({ stage: 'at_risk' });
    expect(rows[1]!.actor_user_id).toBe(IDS.admin);
  });

  it('refuses VAs and unknown stages without writing', async () => {
    const before = (await listClientLifecycle(admin, { db })).get(IDS.tenantB);
    await expect(
      moveClientLifecycle({ userId: IDS.va, role: 'va' }, IDS.tenantB, 'churned', { db })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      moveClientLifecycle(admin, IDS.tenantB, 'bogus' as never, { db })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect((await listClientLifecycle(admin, { db })).get(IDS.tenantB)).toBe(before);
  });

  it('refuses the protected demo client', async () => {
    const before = (await listClientLifecycle(admin, { db })).get(IDS.tenantB);
    await t.admin`update tenants set name = 'Kynetic Restoration (Demo)' where id = ${IDS.tenantB}`;
    await expect(moveClientLifecycle(admin, IDS.tenantB, 'live', { db })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    expect((await listClientLifecycle(admin, { db })).get(IDS.tenantB)).toBe(before);
  });
});
