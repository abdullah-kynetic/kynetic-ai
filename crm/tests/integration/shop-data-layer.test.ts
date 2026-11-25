import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import {
  getAwaySettings,
  getCustomers,
  getFollowUps,
  getInsurance,
  getJobsBoard,
  getMoney,
  getQuotes,
  getTeam
} from '@/server/shop';
import { ModuleDisabledError } from '@/server/modules';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { seedShopPipeline } from '../helpers/shop';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: ReturnType<typeof createDb>; now: Date };
const now = new Date('2026-11-25T18:00:00.000Z'); // Wednesday
const iso = (daysAgo: number) => new Date(now.getTime() - daysAgo * 86_400_000).toISOString();

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app), now };
  const cars = (vehicle: [number, string, string], extra: Record<string, unknown> = {}) => ({
    vehicle_year: vehicle[0],
    vehicle_make: vehicle[1],
    vehicle_model: vehicle[2],
    ...extra
  });
  await seedShopPipeline(tdb.admin, IDS.tenantA, [
    {
      title: 'Bumper repair',
      stage: 'New lead',
      customer: 'Ana Lopez',
      custom: cars([2018, 'Honda', 'Civic'], { payment_type: 'Out-of-pocket' })
    },
    {
      title: 'Door and quarter panel',
      stage: 'Quoted',
      customer: 'Ben Carter',
      valueCents: 420_000,
      createdAt: iso(5),
      custom: cars([2020, 'Ford', 'F-150'], { payment_type: 'Insurance', insurer: 'State Farm' })
    },
    {
      title: 'Hood repaint',
      stage: 'Waiting on insurance',
      customer: 'Cy Diaz',
      valueCents: 310_000,
      ownerId: IDS.ownerA,
      createdAt: iso(3),
      custom: cars([2019, 'Toyota', 'Camry'], {
        payment_type: 'Insurance',
        insurer: 'Allstate',
        claim_number: 'CLM-1042',
        drop_off_date: '2026-11-22'
      })
    },
    {
      title: 'Full respray',
      stage: 'In repair and paint',
      customer: 'Dee Evans',
      valueCents: 1_150_000,
      ownerId: IDS.ownerA,
      custom: cars([2016, 'Chevy', 'Tahoe'], { tech: 'Marco' })
    },
    {
      title: 'Fender',
      stage: 'Picked up',
      customer: 'Eli Fox',
      valueCents: 90_000,
      createdAt: iso(10),
      wonAt: iso(1),
      custom: cars([2015, 'Nissan', 'Altima'], { payment_type: 'Out-of-pocket' })
    },
    {
      title: 'Old win',
      stage: 'Picked up',
      customer: 'Fay Gray',
      valueCents: 500_000,
      createdAt: iso(20),
      wonAt: iso(20)
    },
    { title: 'Lost one', stage: 'Lost', customer: 'Gus Hall', createdAt: iso(4) }
  ]);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled)
    values (${IDS.tenantA}, 'shop_ops', true)`;
});
afterAll(async () => tdb?.drop());

describe('A-6 shop data layer', () => {
  it('every read refuses a tenant without the module', async () => {
    const c = ctx.ownerB();
    for (const read of [
      () => getJobsBoard(c, opts),
      () => getQuotes(c, opts),
      () => getFollowUps(c, opts),
      () => getInsurance(c, opts),
      () => getTeam(c, opts),
      () => getMoney(c, opts),
      () => getCustomers(c, opts),
      () => getAwaySettings(c, opts)
    ])
      await expect(read()).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it('an empty tenant returns empty results and never throws', async () => {
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled)
      values (${IDS.tenantB}, 'shop_ops', true)`;
    await tdb.admin`delete from deal_contacts where tenant_id = ${IDS.tenantB}`;
    await tdb.admin`delete from appointments where tenant_id = ${IDS.tenantB}`;
    await tdb.admin`update calls set deal_id = null where tenant_id = ${IDS.tenantB}`;
    await tdb.admin`update tasks set deal_id = null where tenant_id = ${IDS.tenantB}`;
    await tdb.admin`delete from activities where tenant_id = ${IDS.tenantB} and deal_id is not null`;
    await tdb.admin`delete from deals where tenant_id = ${IDS.tenantB}`;
    await tdb.admin`delete from pipeline_stages where tenant_id = ${IDS.tenantB}`;
    await tdb.admin`delete from pipelines where tenant_id = ${IDS.tenantB}`;
    const c = ctx.ownerB();
    expect((await getJobsBoard(c, opts)).stages).toEqual([]);
    expect((await getQuotes(c, opts)).quotes).toEqual([]);
    expect((await getQuotes(c, opts)).closeRate.rate).toBeNull();
    expect((await getFollowUps(c, opts)).runs).toEqual([]);
    expect(await getInsurance(c, opts)).toEqual({ waiting: [], supplements: [] });
    expect((await getTeam(c, opts)).paintQueue).toEqual([]);
    const money = await getMoney(c, opts);
    expect(money.moneyIn).toEqual([]);
    expect(money.totals).toEqual({ weekInCents: 0, monthInCents: 0, allInCents: 0, outCents: 0 });
    expect((await getAwaySettings(c, opts)).enabled).toBe(false);
  });

  it('jobs board: eight stages as columns with car cards and days in shop', async () => {
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
    const insurance = stages.find((s) => s.name === 'Waiting on insurance')!;
    expect(insurance.jobs).toHaveLength(1);
    expect(insurance.jobs[0]).toMatchObject({
      vehicleLabel: '2019 Toyota Camry',
      customerName: 'Cy Diaz',
      paymentType: 'insurance',
      insurer: 'Allstate',
      claimNumber: 'CLM-1042',
      amountCents: 310_000,
      daysInShop: 3
    });
    const painting = stages.find((s) => s.name === 'In repair and paint')!;
    expect(painting.jobs[0]).toMatchObject({ tech: 'Marco' });
    expect(painting.totalCents).toBe(1_150_000);
    // Closed columns show only the last 60 days: the 20-day win stays, nothing older exists here.
    expect(stages.find((s) => s.name === 'Picked up')!.jobs).toHaveLength(2);
  });

  it('quotes: lists Quoted deals and computes the close rate', async () => {
    const { quotes, closeRate } = await getQuotes(ctx.ownerA(), opts);
    expect(quotes.map((q) => q.title)).toEqual(['Door and quarter panel']);
    expect(quotes[0]!.ageDays).toBe(5);
    expect(closeRate).toMatchObject({ won: 2, lost: 1, stillQuoted: 1, windowDays: 90 });
    expect(closeRate.rate).toBeCloseTo(2 / 4);
  });

  it('insurance: waiting deals, supplements empty', async () => {
    const r = await getInsurance(ctx.ownerA(), opts);
    expect(r.waiting.map((j) => j.title)).toEqual(['Hood repaint']);
    expect(r.supplements).toEqual([]);
  });

  it('team: open deals by owner, an Unassigned bucket and the paint queue', async () => {
    const t = await getTeam(ctx.ownerA(), opts);
    const owner = t.owners.find((o) => o.ownerId === IDS.ownerA)!;
    expect(owner.openJobs.map((j) => j.title).sort()).toEqual(['Full respray', 'Hood repaint']);
    expect(owner.totalCents).toBe(1_460_000);
    const unassigned = t.owners.find((o) => o.ownerId === null)!;
    expect(unassigned.openJobs.map((j) => j.title).sort()).toEqual([
      'Bumper repair',
      'Door and quarter panel'
    ]);
    expect(t.paintQueue.map((j) => j.title)).toEqual(['Full respray']);
  });

  it('money: won deals in, nothing out, week and month totals', async () => {
    const m = await getMoney(ctx.ownerA(), opts);
    expect(m.moneyIn.map((r) => r.title)).toEqual(['Fender', 'Old win']);
    expect(m.moneyIn[0]).toMatchObject({ customerName: 'Eli Fox', paymentType: 'out_of_pocket' });
    expect(m.moneyOut).toEqual([]);
    // Tuesday 11-24 is this week (Pacific week starts Monday 11-23); the win from 11-05 is this month only.
    expect(m.totals).toEqual({
      weekInCents: 90_000,
      monthInCents: 590_000,
      allInCents: 590_000,
      outCents: 0
    });
  });

  it('customers: totals per contact and review status not yet requested', async () => {
    const { customers } = await getCustomers(ctx.ownerA(), opts);
    const eli = customers.find((c) => c.name === 'Eli Fox')!;
    expect(eli).toMatchObject({ jobs: 1, lifetimeCents: 90_000, reviewStatus: 'not_requested' });
    expect(customers.find((c) => c.name === 'Cy Diaz')!.lifetimeCents).toBe(0);
  });

  it('never crosses tenants: tenant B sees none of tenant A', async () => {
    const c = ctx.ownerB();
    const a = await getCustomers(ctx.ownerA(), opts);
    const b = await getCustomers(c, opts);
    expect(b.customers.map((x) => x.name)).toEqual(['Contact b']);
    expect(a.customers.map((x) => x.name)).not.toContain('Contact b');
    expect(a.customers.length).toBeGreaterThan(5);
  });

  it('follow-ups: runs with steps marked sent, next and pending', async () => {
    const [automation] =
      await tdb.admin`insert into automations (tenant_id, kind, template_key, name, enabled)
      values (${IDS.tenantA}, 'template', 'quote_followup', 'Quote follow-up', true) returning id`;
    for (const [i, delay] of [0, 1440, 4320].entries())
      await tdb.admin`insert into automation_steps (tenant_id, automation_id, position, channel, delay_minutes, body)
        values (${IDS.tenantA}, ${automation!.id}, ${i + 1}, 'sms', ${delay}, 'Synthetic')`;
    const [contact] =
      await tdb.admin`select contact_id as id from deal_contacts dc join deals d on d.id = dc.deal_id
        where d.title = 'Door and quarter panel' and d.tenant_id = ${IDS.tenantA}`;
    await tdb.admin`insert into automation_runs (tenant_id, automation_id, contact_id, current_step, status, next_run_at)
      values (${IDS.tenantA}, ${automation!.id}, ${contact!.id}, 2, 'active', now())`;
    const { runs } = await getFollowUps(ctx.ownerA(), opts);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.customerName).toBe('Ben Carter');
    expect(runs[0]!.steps.map((s) => s.state)).toEqual(['sent', 'next', 'pending']);
    expect(runs[0]!.replied).toBe(false);
    await expect(getFollowUps(ctx.ownerB(), opts)).resolves.toEqual({ runs: [] });
  });
});
