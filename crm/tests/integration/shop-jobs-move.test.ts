import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { moveDeal } from '@/server/deals';
import { stopJobs } from '@/server/jobs';
import { getJobsBoard } from '@/server/shop';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { seedShopPipeline } from '../helpers/shop';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: ReturnType<typeof createDb> };
let stageIds: Record<string, string>;
let dealId: string;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  const seeded = await seedShopPipeline(tdb.admin, IDS.tenantA, [
    {
      title: 'Bumper',
      stage: 'Quoted',
      customer: 'Ana Lopez',
      valueCents: 120_000,
      custom: {
        vehicle_year: 2019,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        payment_type: 'Insurance',
        tech: 'Sam'
      }
    }
  ]);
  stageIds = seeded.stageIds;
  dealId = seeded.dealIds[0]!;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'shop_ops', true)`;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('C-1 and C-2 jobs board', () => {
  it('shows the eight stages with car cards', async () => {
    const { stages } = await getJobsBoard(ctx.ownerA(), opts);
    expect(stages.map((s) => s.name)).toEqual([
      'New lead',
      'Quoted',
      'Waiting on insurance',
      'Parts ordered',
      'In repair and paint',
      'Ready for pickup',
      'Picked up',
      'Lost'
    ]);
    const card = stages.find((s) => s.name === 'Quoted')!.jobs[0]!;
    expect(card).toMatchObject({
      vehicleLabel: '2019 Toyota Camry',
      customerName: 'Ana Lopez',
      tech: 'Sam',
      paymentType: 'insurance',
      amountCents: 120_000
    });
  });

  it('a move changes the stage and creates no outbound message or call', async () => {
    const outbound = async () => {
      const [m] =
        await tdb.admin`select count(*)::int as n from messages where tenant_id = ${IDS.tenantA}`;
      const [c] =
        await tdb.admin`select count(*)::int as n from calls where tenant_id = ${IDS.tenantA} and direction = 'outbound'`;
      return [m!.n, c!.n];
    };
    const before = await outbound();
    await moveDeal(ctx.ownerA(), dealId, { stageId: stageIds['In repair and paint']! }, opts);
    const [row] = await tdb.admin`select stage_id from deals where id = ${dealId}`;
    expect(row!.stage_id).toBe(stageIds['In repair and paint']);
    expect(await outbound()).toEqual(before);
    // The only queued work is the internal stage-change event, never a send.
    const queued = await tdb.admin`select distinct name from pgboss.job`;
    expect(queued.map((r) => r.name)).toEqual(['event.dispatch']);
    const { stages } = await getJobsBoard(ctx.ownerA(), opts);
    expect(stages.find((s) => s.name === 'In repair and paint')!.jobs).toHaveLength(1);
    expect(stages.find((s) => s.name === 'Quoted')!.jobs).toHaveLength(0);
  });
});
