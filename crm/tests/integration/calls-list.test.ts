import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/server/auth';
import { listCalls } from '@/server/calls';
import { createDb, type Db } from '@/server/db/client';
import { ModuleDisabledError } from '@/server/modules';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';

let tdb: TestDatabase;
let opts: { db: Db };
let a: SeededTenant;

const owner = (tenantId: string, userId: string): Actor => ({
  userId,
  kyneticRole: null,
  membership: { tenantId, role: 'owner', canExport: false, canBulkDelete: false },
  viewAs: null
});

beforeAll(async () => {
  tdb = await createTestDatabase();
  ({ a } = await seedTwoTenants(tdb.admin));
  opts = { db: createDb(tdb.app) };
  // 10,000 calls for tenant A spread over 100 days, plus 3 for tenant B (each tenant also has one seeded call).
  await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, duration_s, outcome, sentiment)
    select ${IDS.tenantA}, case when n % 2 = 0 then ${a.contactId}::uuid end, 'elevenlabs', 'c' || n,
      case when n % 3 = 0 then 'inbound' else 'outbound' end,
      timestamptz '2026-07-01 12:00:00+00' + (n * interval '14 minutes'), 60 + n % 300,
      (array['booked','qualified','not_interested','voicemail','no_answer','transferred','dnc','other'])[1 + n % 8], 'neutral'
    from generate_series(1, 10000) n`;
  await tdb.admin`insert into calls (tenant_id, provider, provider_call_id, direction, started_at, outcome)
    select ${IDS.tenantB}, 'elevenlabs', 'b' || n, 'outbound', now(), 'booked' from generate_series(1, 3) n`;
});
afterAll(async () => {
  await tdb?.drop();
});

describe('M4-10 calls list (F-26)', () => {
  const actor = owner(IDS.tenantA, IDS.ownerA);

  it('returns the newest page with the total and the contact name', async () => {
    const r = await listCalls(actor, ctx.ownerA(), {}, opts);
    expect(r.total).toBe(10001);
    expect(r.rows).toHaveLength(20);
    expect(r.timeZone).toBe('America/Los_Angeles');
    const times = r.rows.map((x) => x.startedAt);
    expect(times).toEqual([...times].sort().reverse());
    expect(r.rows.find((x) => x.contact)?.contact?.name).toBeTruthy();
  });

  it('filters by outcome', async () => {
    const r = await listCalls(actor, ctx.ownerA(), { outcome: 'booked', pageSize: 50 }, opts);
    expect(r.total).toBe(1250);
    expect(r.rows.every((x) => x.outcome === 'booked')).toBe(true);
  });

  it('filters by date in the tenant time zone, end day inclusive', async () => {
    // First call is 2026-07-01 12:14 UTC = 05:14 PT; day 2026-07-01 PT has calls from n=1.
    const r = await listCalls(actor, ctx.ownerA(), { from: '2026-07-02', to: '2026-07-02' }, opts);
    // 24h / 14min -> 102 or 103 calls in one local day.
    expect(r.total).toBeGreaterThanOrEqual(102);
    expect(r.total).toBeLessThanOrEqual(103);
    for (const row of r.rows) {
      const local = new Date(row.startedAt).toLocaleDateString('en-CA', {
        timeZone: 'America/Los_Angeles'
      });
      expect(local).toBe('2026-07-02');
    }
  });

  it('combines filters and pages', async () => {
    const p1 = await listCalls(actor, ctx.ownerA(), { direction: 'inbound', page: 1 }, opts);
    const p2 = await listCalls(actor, ctx.ownerA(), { direction: 'inbound', page: 2 }, opts);
    expect(p1.total).toBe(3333);
    expect(p1.rows.every((x) => x.direction === 'inbound')).toBe(true);
    expect(p2.rows[0].id).not.toBe(p1.rows[0].id);
  });

  it('rejects bad filters and page sizes', async () => {
    await expect(listCalls(actor, ctx.ownerA(), { outcome: 'nope' }, opts)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    await expect(listCalls(actor, ctx.ownerA(), { pageSize: 7 }, opts)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    await expect(listCalls(actor, ctx.ownerA(), { page: 'x' }, opts)).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
  });

  it("never shows another tenant's calls", async () => {
    const r = await listCalls(owner(IDS.tenantB, IDS.ownerB), ctx.ownerB(), {}, opts);
    expect(r.total).toBe(4);
  });

  it('refuses a user with no membership, and a tenant with alex_core off', async () => {
    await expect(
      listCalls(
        { userId: IDS.ownerB, kyneticRole: null, membership: null, viewAs: null },
        ctx.ownerA(),
        {},
        opts
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantB} and module_key = 'alex_core'`;
    await expect(
      listCalls(owner(IDS.tenantB, IDS.ownerB), ctx.ownerB(), {}, opts)
    ).rejects.toBeInstanceOf(ModuleDisabledError);
  });

  it('reads a 10,000-call tenant in under 500 ms p95', async () => {
    const filters = [
      {},
      { outcome: 'booked' },
      { from: '2026-08-01', to: '2026-08-31' },
      { page: 40 }
    ];
    const times: number[] = [];
    for (let i = 0; i < 40; i++) {
      const t = performance.now();
      await listCalls(actor, ctx.ownerA(), filters[i % filters.length], opts);
      times.push(performance.now() - t);
    }
    times.sort((x, y) => x - y);
    const p95 = times[Math.ceil(times.length * 0.95) - 1];
    expect(p95).toBeLessThan(500);
  });
});
