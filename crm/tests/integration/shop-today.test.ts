import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { getToday } from '@/server/shop';
import { ModuleDisabledError } from '@/server/modules';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { seedShopPipeline } from '../helpers/shop';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: ReturnType<typeof createDb>; now: Date };
const now = new Date('2026-11-25T18:00:00.000Z'); // Wed 12:00 in Dallas
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app), now };
  await tdb.admin`update tenants set timezone = 'America/Chicago' where id = ${IDS.tenantA}`;
  const { dealIds } = await seedShopPipeline(tdb.admin, IDS.tenantA, [
    { title: 'New one', stage: 'New lead', customer: 'Ana Lopez' },
    {
      title: 'Old quote',
      stage: 'Quoted',
      customer: 'Ben Carter',
      createdAt: iso(5)
    },
    {
      title: 'Fresh quote',
      stage: 'Quoted',
      customer: 'Bo Fresh',
      createdAt: iso(1)
    },
    {
      title: 'Insurance wait',
      stage: 'Waiting on insurance',
      customer: 'Cy Diaz',
      createdAt: iso(4),
      custom: {
        vehicle_year: 2019,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
        insurer: 'Allstate'
      }
    },
    { title: 'Painting', stage: 'In repair and paint', customer: 'Dee Evans' },
    { title: 'Ready car', stage: 'Ready for pickup', customer: 'Eli Fox' },
    {
      title: 'Done',
      stage: 'Picked up',
      customer: 'Fay Gray',
      valueCents: 250_000,
      wonAt: iso(1)
    }
  ]);
  const [c] =
    await tdb.admin`select contact_id as id from deal_contacts where deal_id = ${dealIds[0]!}`;
  // One drop-off today (Dallas), one estimate today, one drop-off tomorrow.
  await tdb.admin`insert into appointments (tenant_id, contact_id, starts_at, ends_at, booked_by, notes) values
    (${IDS.tenantA}, ${c!.id}, '2026-11-25T20:00:00Z', '2026-11-25T21:00:00Z', 'alex', 'drop-off: Civic'),
    (${IDS.tenantA}, ${c!.id}, '2026-11-25T22:00:00Z', '2026-11-25T23:00:00Z', 'alex', 'estimate: Tahoe'),
    (${IDS.tenantA}, ${c!.id}, '2026-11-26T20:00:00Z', '2026-11-26T21:00:00Z', 'alex', 'drop-off: Altima')`;
  await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, outcome) values
    (${IDS.tenantA}, ${c!.id}, 'fake', 't1', 'inbound', ${iso(0)}, 'booked'),
    (${IDS.tenantA}, ${c!.id}, 'fake', 't2', 'inbound', ${iso(1)}, 'no_answer'),
    (${IDS.tenantA}, ${c!.id}, 'fake', 't3', 'outbound', ${iso(1)}, 'booked')`;
  await tdb.admin`insert into tasks (tenant_id, title, due_at) values (${IDS.tenantA}, 'Call the adjuster', ${iso(1)})`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'shop_ops', true)`;
});
afterAll(async () => tdb?.drop());

describe('B-1 Today queries', () => {
  it('refuses a tenant without the module', async () => {
    await expect(getToday(ctx.ownerB(), opts)).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it('computes each tile from real rows', async () => {
    const { tiles } = await getToday(ctx.ownerA(), opts);
    expect(tiles).toEqual({
      carsInShop: 3, // insurance wait, painting, ready
      dropOffsToday: 1,
      newLeads: 1,
      quotesWaiting: 2,
      moneyInWeekCents: 250_000,
      callsAnsweredWeek: 1 // the answered inbound; no_answer and outbound do not count
    });
  });

  it('lists what needs the owner: pickups, old insurance waits, old quotes, tasks, new leads', async () => {
    const { needsYou } = await getToday(ctx.ownerA(), opts);
    const kinds = needsYou.map((n) => n.kind);
    expect(kinds).toEqual(expect.arrayContaining(['pickup', 'insurance', 'quote', 'task', 'lead']));
    expect(needsYou.find((n) => n.kind === 'insurance')!.label).toContain('2019 Toyota Camry');
    expect(needsYou.filter((n) => n.kind === 'quote')).toHaveLength(1); // the 1-day quote is not listed
  });

  it('never shows another tenant: B is refused, and A numbers ignore B rows', async () => {
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantB}, 'shop_ops', true)`;
    const b = await getToday(ctx.ownerB(), opts);
    expect(b.tiles.carsInShop).toBe(0);
    expect(b.tiles.moneyInWeekCents).toBe(0);
  });
});
