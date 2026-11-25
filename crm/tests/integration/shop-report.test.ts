import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { getWeeklyReport, REPORT_WEEKS } from '@/server/shop';
import { ModuleDisabledError } from '@/server/modules';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { seedShopPipeline } from '../helpers/shop';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: ReturnType<typeof createDb>; now: Date };
const now = new Date('2026-11-25T18:00:00.000Z'); // Wed, week of Mon Nov 23 (Dallas)
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app), now };
  await tdb.admin`update tenants set timezone = 'America/Chicago' where id = ${IDS.tenantA}`;
  const { dealIds } = await seedShopPipeline(tdb.admin, IDS.tenantA, [
    // This week: two insurance jobs and one out-of-pocket, one with no payment type.
    {
      title: 'A',
      stage: 'Picked up',
      customer: 'Ann One',
      valueCents: 300_000,
      wonAt: iso(1),
      custom: { payment_type: 'Insurance' }
    },
    {
      title: 'B',
      stage: 'Picked up',
      customer: 'Bob Two',
      valueCents: 100_000,
      wonAt: iso(0),
      custom: { payment_type: 'Insurance' }
    },
    {
      title: 'C',
      stage: 'Picked up',
      customer: 'Cat Three',
      valueCents: 200_000,
      wonAt: iso(2),
      custom: { payment_type: 'Out-of-pocket' }
    },
    { title: 'D', stage: 'Picked up', customer: 'Dan Four', valueCents: 0, wonAt: iso(1) },
    // Two weeks ago.
    {
      title: 'E',
      stage: 'Picked up',
      customer: 'Eve Five',
      valueCents: 500_000,
      wonAt: iso(14),
      custom: { payment_type: 'Out-of-pocket' }
    },
    // Created this week and quoted; created this week and still New lead; lost after a quote.
    { title: 'Q1', stage: 'Quoted', customer: 'Quin Six', createdAt: iso(1) },
    { title: 'N1', stage: 'New lead', customer: 'Nell Seven', createdAt: iso(1) },
    { title: 'L1', stage: 'Lost', customer: 'Lou Eight', createdAt: iso(1) }
  ]);
  const [c] =
    await tdb.admin`select contact_id as id from deal_contacts where deal_id = ${dealIds[0]!}`;
  await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, outcome) values
    (${IDS.tenantA}, ${c!.id}, 'fake', 'r1', 'inbound', ${iso(1)}, 'booked'),
    (${IDS.tenantA}, ${c!.id}, 'fake', 'r2', 'inbound', ${iso(1)}, 'no_answer'),
    (${IDS.tenantA}, ${c!.id}, 'fake', 'r3', 'outbound', ${iso(1)}, 'booked'),
    (${IDS.tenantA}, ${c!.id}, 'fake', 'r4', 'inbound', ${iso(8)}, 'booked')`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'shop_ops', true)`;
});
afterAll(async () => tdb?.drop());

describe('D-1 weekly report numbers', () => {
  it('refuses a tenant without the module', async () => {
    await expect(getWeeklyReport(ctx.ownerB(), opts)).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it('returns eight weeks, oldest first, ending with this week', async () => {
    const r = await getWeeklyReport(ctx.ownerA(), opts);
    expect(r.weeks).toHaveLength(REPORT_WEEKS);
    expect(r.current).toBe(r.weeks.at(-1));
    const starts = r.weeks.map((w) => w.weekStart);
    expect([...starts].sort()).toEqual(starts);
  });

  it('computes this week from real rows', async () => {
    const { current } = await getWeeklyReport(ctx.ownerA(), opts);
    expect(current.carsDone).toBe(4);
    expect(current.moneyInCents).toBe(600_000);
    expect(current.avgTicketCents).toBe(150_000);
    expect(current.insurance).toEqual({ cars: 2, cents: 400_000 });
    expect(current.outOfPocket).toEqual({ cars: 1, cents: 200_000 });
    expect(current.unspecifiedCars).toBe(1);
    expect(current.callsAnswered).toBe(1); // no_answer, outbound and last week's do not count
    // Q1 plus the five picked-up jobs (all created now); N1 (New lead) and L1 (lost) do not count.
    expect(current.quotesSent).toBe(6);
  });

  it('puts earlier weeks in their own bucket and leaves empty weeks at zero', async () => {
    const { weeks } = await getWeeklyReport(ctx.ownerA(), opts);
    const twoAgo = weeks[weeks.length - 3]!;
    expect(twoAgo.carsDone).toBe(1);
    expect(twoAgo.moneyInCents).toBe(500_000);
    expect(twoAgo.avgTicketCents).toBe(500_000);
    const empty = weeks[0]!;
    expect(empty).toMatchObject({ carsDone: 0, moneyInCents: 0, avgTicketCents: null });
    // Last week's one answered inbound call.
    expect(weeks[weeks.length - 2]!.callsAnswered).toBe(1);
  });
});
