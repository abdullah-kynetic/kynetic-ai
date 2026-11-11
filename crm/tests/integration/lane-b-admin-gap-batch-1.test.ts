import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { regenerateChecklist } from '@/server/admin/checklist';
import { loadClientOverview } from '@/server/admin/client-overview';
import { createDb, type Db } from '@/server/db/client';
import { listSupportQueue, setSupportRequestStatus } from '@/server/support';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
const admin = { userId: IDS.admin, role: 'admin' as const };
const actor = { id: IDS.admin, kyneticRole: 'admin' as const };

beforeAll(async () => {
  tdb = await createTestDatabase();
  const seeded = await seedTwoTenants(tdb.admin);
  await tdb.admin`update deals set value_cents = 1250000 where id = ${seeded.a.dealId}`;
  await tdb.admin`update deals set value_cents = 9900000 where id = ${seeded.b.dealId}`;
  db = createDb(tdb.app);
});

afterAll(async () => tdb?.drop());

describe('Lane B admin gap batch 1', () => {
  it('returns pipeline count and value for only the selected tenant', async () => {
    const overview = await loadClientOverview(actor, IDS.tenantA, { db });
    expect(overview.stages).toHaveLength(1);
    expect(overview.stages[0]).toMatchObject({ deals: 1, valueCents: 1_250_000 });
    expect(JSON.stringify(overview)).not.toContain('9900000');
  });

  it('regenerates missing enabled-system steps, preserves work, and is idempotent', async () => {
    await tdb.admin`update onboarding_steps set status = 'doing', note = 'Keep this' where tenant_id = ${IDS.tenantA} and step_key = 'kickoff'`;
    expect(await regenerateChecklist(admin, IDS.tenantA, { db })).toBeGreaterThan(0);
    expect(await regenerateChecklist(admin, IDS.tenantA, { db })).toBe(0);

    const [preserved] = await tdb.admin`
      select status, note from onboarding_steps
      where tenant_id = ${IDS.tenantA} and step_key = 'kickoff'`;
    expect(preserved).toMatchObject({ status: 'doing', note: 'Keep this' });
    const [alex] = await tdb.admin`
      select count(*)::int as n from onboarding_steps
      where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    expect(alex!.n).toBeGreaterThan(0);
    const [other] = await tdb.admin`
      select count(*)::int as n from onboarding_steps where tenant_id = ${IDS.tenantB}`;
    expect(other!.n).toBe(1);
    const [audits] = await tdb.admin`
      select count(*)::int as n from audit_log
      where tenant_id = ${IDS.tenantA} and action = 'checklist.regenerate'`;
    expect(audits!.n).toBe(2);
  });

  it('refuses checklist regeneration to a VA without writing', async () => {
    const [before] = await tdb.admin`
      select count(*)::int as n from onboarding_steps where tenant_id = ${IDS.tenantB}`;
    await expect(
      regenerateChecklist({ userId: IDS.va, role: 'va' }, IDS.tenantB, { db })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const [after] = await tdb.admin`
      select count(*)::int as n from onboarding_steps where tenant_id = ${IDS.tenantB}`;
    expect(after!.n).toBe(before!.n);
  });

  it('filters the staff support queue by status while retaining open-first defaults', async () => {
    const queue = await listSupportQueue(admin, { db });
    const tenantA = queue.find((row) => row.tenantId === IDS.tenantA)!;
    await setSupportRequestStatus(admin, tenantA.id, 'resolved', { db });
    const resolved = await listSupportQueue(admin, { db, status: 'resolved' });
    expect(resolved.map((row) => row.id)).toContain(tenantA.id);
    expect(resolved.every((row) => row.status === 'resolved')).toBe(true);
    const open = await listSupportQueue(admin, { db, status: 'open' });
    expect(open.map((row) => row.id)).not.toContain(tenantA.id);
  });
});
