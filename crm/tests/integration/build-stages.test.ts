import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  listBuildSystems,
  loadClientBuildState,
  moveClientLifecycle,
  removeBuildSystem,
  saveBuildSystem
} from '@/server/admin';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createDb } from '@/server/db/client';
import type { Db } from '@/server/db/client';

let t: TestDatabase;
let db: Db;
const admin = { userId: IDS.admin, role: 'admin' as const };
const owner = {
  tenantId: IDS.tenantA,
  userId: IDS.ownerA,
  role: 'owner' as const
};
const sys = (key: string, stage: 'planned' | 'building' | 'testing' | 'live') => ({
  key,
  name: key,
  stage
});

beforeAll(async () => {
  t = await createTestDatabase({ jobs: false });
  await seedTwoTenants(t.admin);
  db = createDb(t.app);
  await t.admin`delete from client_build_systems`;
  await t.admin`update tenants set status = 'onboarding', go_live_at = null where id = ${IDS.tenantA}`;
});
afterAll(async () => {
  await t?.drop();
});

describe('client build stages', () => {
  it('shows the normal portal until systems are listed', async () => {
    expect(await loadClientBuildState(owner, { db })).toBeNull();
  });

  it('derives Building, then Testing, from the systems', async () => {
    await saveBuildSystem(admin, IDS.tenantA, sys('a', 'building'), { db });
    await saveBuildSystem(admin, IDS.tenantA, sys('b', 'planned'), { db });
    expect((await loadClientBuildState(owner, { db }))?.phase).toBe('building');
    await saveBuildSystem(admin, IDS.tenantA, sys('a', 'testing'), { db });
    await saveBuildSystem(admin, IDS.tenantA, sys('b', 'testing'), { db });
    expect((await loadClientBuildState(owner, { db }))?.phase).toBe('testing');
    expect(await listBuildSystems(admin, IDS.tenantA, { db })).toHaveLength(2);
  });

  it('keeps the other tenant out and refuses VAs and owners writing', async () => {
    expect(
      await loadClientBuildState({ ...owner, tenantId: IDS.tenantB, userId: IDS.ownerB }, { db })
    ).toBeNull();
    await expect(
      saveBuildSystem({ userId: IDS.va, role: 'va' }, IDS.tenantA, sys('c', 'planned'), { db })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('moving to Live opens the portal and stamps go-live; moving back keeps it onboarding', async () => {
    await moveClientLifecycle(admin, IDS.tenantA, 'live', { db });
    const [live] = await t.admin`select status, go_live_at from tenants where id = ${IDS.tenantA}`;
    expect(live!.status).toBe('active');
    expect(live!.go_live_at).not.toBeNull();
    expect(await loadClientBuildState(owner, { db })).toBeNull();
    await moveClientLifecycle(admin, IDS.tenantA, 'testing', { db });
    const [back] = await t.admin`select status from tenants where id = ${IDS.tenantA}`;
    expect(back!.status).toBe('onboarding');
  });

  it('removes a system', async () => {
    await removeBuildSystem(admin, IDS.tenantA, 'b', { db });
    expect((await listBuildSystems(admin, IDS.tenantA, { db })).map((s) => s.key)).toEqual(['a']);
  });
});
