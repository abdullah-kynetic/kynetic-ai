import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { removeShopDemo, seedShopDemo, SHOP_DEMO_BATCH } from '@/server/db/seed/shop-demo';
import { getJobsBoard, hasShopDemoData } from '@/server/shop';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { seedShopPipeline } from '../helpers/shop';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
const now = new Date('2026-11-25T18:00:00.000Z');
const slugA = 'tenant-a';

let planned = 0;

const counts = async (tenant: string) => {
  const one = async (table: string) =>
    Number(
      (
        await tdb.admin.unsafe(`select count(*)::int as n from ${table} where tenant_id = $1`, [
          tenant
        ])
      )[0]!.n
    );
  return {
    contacts: await one('contacts'),
    deals: await one('deals'),
    calls: await one('calls'),
    messages: await one('messages'),
    appointments: await one('appointments'),
    tasks: await one('tasks'),
    automations: await one('automations'),
    runs: await one('automation_runs'),
    ledger: Number(
      (
        await tdb.admin`select count(*)::int as n from demo_seed_records where tenant_id = ${tenant}`
      )[0]!.n
    )
  };
};

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  await seedShopPipeline(tdb.admin, IDS.tenantA, []);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled)
    values (${IDS.tenantA}, 'shop_ops', true)`;
});
afterAll(async () => tdb?.drop());

describe('A-7 shop sample data seeder', () => {
  it('is a dry run by default and writes nothing', async () => {
    const before = await counts(IDS.tenantA);
    const result = await seedShopDemo(tdb.admin, { slug: slugA, now });
    expect(result.status).toBe('planned');
    expect(result.rows).toBeGreaterThan(50);
    planned = result.rows;
    expect(await counts(IDS.tenantA)).toEqual(before);
  });

  it('never touches a tenant without the module, or a missing one', async () => {
    const before = await counts(IDS.tenantB);
    expect(await seedShopDemo(tdb.admin, { slug: 'tenant-b', apply: true, now })).toMatchObject({
      status: 'skipped_module_off'
    });
    expect(await seedShopDemo(tdb.admin, { slug: 'no-such-shop', apply: true, now })).toMatchObject(
      {
        status: 'skipped_missing'
      }
    );
    expect(await counts(IDS.tenantB)).toEqual(before);
  });

  it('applies once, tags every row, and is a no-op the second time', async () => {
    const before = await counts(IDS.tenantA);
    const result = await seedShopDemo(tdb.admin, { slug: slugA, apply: true, now });
    expect(result.status).toBe('seeded');
    const after = await counts(IDS.tenantA);
    expect(after.contacts - before.contacts).toBe(24);
    expect(after.deals - before.deals).toBe(24);
    expect(after.calls - before.calls).toBe(18);
    // Every contact and deal the seed wrote carries the batch tag; the fixture rows do not.
    const tagged = await tdb.admin`select
      (select count(*)::int from contacts where tenant_id = ${IDS.tenantA} and imported_source = ${SHOP_DEMO_BATCH}) as c,
      (select count(*)::int from deals where tenant_id = ${IDS.tenantA} and imported_source = ${SHOP_DEMO_BATCH}) as d`;
    expect(tagged[0]).toMatchObject({ c: 24, d: 24 });
    // The ledger holds exactly the rows written plus the meta marker.
    expect(after.ledger - before.ledger).toBe(result.rows);
    expect(result.rows).toBe(planned);
    expect((await seedShopDemo(tdb.admin, { slug: slugA, apply: true, now })).status).toBe(
      'already_seeded'
    );
    expect(await counts(IDS.tenantA)).toEqual(after);
  });

  it('puts cars in every column with insurance and out-of-pocket tickets in range', async () => {
    const { stages } = await getJobsBoard(ctx.ownerA(), { db: createDb(tdb.app), now });
    for (const s of stages) expect(s.jobs.length, s.name).toBeGreaterThan(0);
    const all = stages.flatMap((s) => s.jobs);
    const insured = all.filter((j) => j.paymentType === 'insurance');
    const own = all.filter((j) => j.paymentType === 'out_of_pocket');
    expect(insured.length).toBeGreaterThan(5);
    expect(own.length).toBeGreaterThan(5);
    for (const j of insured) {
      expect(j.amountCents).toBeGreaterThanOrEqual(120_000);
      expect(j.amountCents).toBeLessThanOrEqual(2_200_000);
    }
    for (const j of own) {
      expect(j.amountCents).toBeGreaterThanOrEqual(20_000);
      expect(j.amountCents).toBeLessThanOrEqual(600_000);
    }
    const phones = await tdb.admin`select primary_phone_e164 as p from contacts
      where tenant_id = ${IDS.tenantA} and imported_source = ${SHOP_DEMO_BATCH}`;
    for (const r of phones) expect(r.p).toMatch(/^\+1214555\d{4}$/);
  });

  it('the Demo data banner query is true while sample rows exist', async () => {
    expect(await hasShopDemoData(ctx.ownerA(), { db: createDb(tdb.app) })).toBe(true);
  });

  it('remove is a dry run by default, then deletes exactly the batch and nothing else', async () => {
    const seeded = await counts(IDS.tenantA);
    const dry = await removeShopDemo(tdb.admin, { slug: slugA });
    expect(dry.status).toBe('planned');
    expect(await counts(IDS.tenantA)).toEqual(seeded);
    const removed = await removeShopDemo(tdb.admin, { slug: slugA, apply: true });
    expect(removed.status).toBe('removed');
    const after = await counts(IDS.tenantA);
    // Back to the fixture's own rows: its contact, its calls, its messages are untouched.
    expect(after.contacts).toBe(1);
    expect(after.deals).toBe(0);
    expect(after.calls).toBe(1);
    expect(after.messages).toBe(1);
    expect(after.ledger).toBe(0);
    expect(await hasShopDemoData(ctx.ownerA(), { db: createDb(tdb.app) })).toBe(false);
    expect((await removeShopDemo(tdb.admin, { slug: slugA, apply: true })).status).toBe(
      'not_seeded'
    );
  });
});
