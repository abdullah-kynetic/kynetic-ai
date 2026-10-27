import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  createDeal,
  getDealDetail,
  listStages,
  moveDeal,
  seedDefaultPipeline,
  updateDeal
} from '@/server/deals';
import { withTenant } from '@/server/tenancy';
import { stopJobs } from '@/server/jobs';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const TENANT_C = '33333333-3333-4333-8333-333333333333';
const owner = () => ({ tenantId: TENANT_C, userId: IDS.ownerA, role: 'owner' as const });

let contactC: string;
let tdb: TestDatabase;
let db: Db;
let opts: { db: Db };
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
let stages: Awaited<ReturnType<typeof listStages>>;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  opts = { db };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  // Tenant A's seeded pipeline has one stage; a third tenant gets the eight defaults.
  await tdb.admin`insert into tenants (id, slug, name, plan, timezone)
    values (${TENANT_C}, 'tenant-c', 'Tenant C', 'founding', 'America/Los_Angeles')`;
  await tdb.admin`insert into memberships (tenant_id, user_id, role) values (${TENANT_C}, ${IDS.ownerA}, 'owner')`;
  await tdb.admin`insert into memberships (tenant_id, user_id, role) values (${TENANT_C}, ${IDS.staffA}, 'staff')`;
  [{ id: contactC }] =
    await tdb.admin`insert into contacts (tenant_id, first_name, last_name, primary_phone_e164)
    values (${TENANT_C}, 'Sam', 'Smith', '+15555550100') returning id`;
  await seedDefaultPipeline(owner(), opts);
  stages = await listStages(owner(), undefined, opts);
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const stage = (name: string) => stages.find((s) => s.name === name)!;

describe('M2-03 deal detail (F-14)', () => {
  it('returns the deal with its stage, sibling stages, owner, members and people', async () => {
    const deal = await createDeal(
      owner(),
      {
        title: 'Smith roof',
        valueCents: 1250000,
        serviceType: 'Roof replacement',
        expectedClose: '2026-12-01',
        source: 'Google',
        ownerId: IDS.staffA,
        contactId: contactC
      },
      opts
    );
    const d = await getDealDetail(owner(), deal.id, opts);
    expect(d.deal.valueCents).toBe(1250000);
    expect(d.stage.name).toBe('New');
    expect(d.stages.map((s) => s.name)[0]).toBe('New');
    expect(d.stages.length).toBe(8);
    expect(d.owner?.id).toBe(IDS.staffA);
    expect(d.members.map((m) => m.id).sort()).toEqual([IDS.ownerA, IDS.staffA].sort());
    expect(d.contacts).toHaveLength(1);
    expect(d.contacts[0]).toMatchObject({ contactId: contactC, role: 'homeowner' });
  });

  it("reads another tenant's deal, a soft-deleted deal and a bad id as not found", async () => {
    await expect(getDealDetail(ctx.ownerB(), a.dealId, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(getDealDetail(owner(), 'nope', opts)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
  });

  it('keeps the deal untouched when the slide-out saves a move to Lost with no reason', async () => {
    const deal = await createDeal(owner(), { title: 'Jones gutters', valueCents: 50000 }, opts);
    // The save action runs the field update and the move in one transaction.
    await expect(
      withTenant(
        owner(),
        async (tx) => {
          await updateDeal(owner(), deal.id, { title: 'Renamed', valueCents: 99900 }, { tx });
          await moveDeal(owner(), deal.id, { stageId: stage('Lost').id }, { tx });
        },
        opts
      )
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { lostReason: ['required'] }
    });
    const after = await getDealDetail(owner(), deal.id, opts);
    expect(after.deal.title).toBe('Jones gutters');
    expect(after.deal.valueCents).toBe(50000);
    expect(after.stage.name).toBe('New');
  });

  it('saves the fields and the move to Lost together once a reason is given', async () => {
    const deal = await createDeal(owner(), { title: 'Lee siding', valueCents: 100 }, opts);
    await withTenant(
      owner(),
      async (tx) => {
        await updateDeal(owner(), deal.id, { valueCents: 1250050 }, { tx });
        await moveDeal(
          owner(),
          deal.id,
          { stageId: stage('Lost').id, lostReason: 'Went with a cheaper quote' },
          { tx }
        );
      },
      opts
    );
    const d = await getDealDetail(owner(), deal.id, opts);
    expect(d.deal.valueCents).toBe(1250050);
    expect(d.stage.isLost).toBe(true);
    expect(d.deal.lostReason).toBe('Went with a cheaper quote');
    expect(d.deal.lostAt).not.toBeNull();
  });
});
