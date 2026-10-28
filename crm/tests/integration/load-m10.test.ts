import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { searchContacts } from '@/server/contacts';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let appDb: Db;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  appDb = createDb(tdb.app);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full') on conflict (tenant_id, module_key) do update set enabled = true, level = 'full'`;
  await tdb.admin`insert into contacts (tenant_id, first_name, phones, emails)
    select ${IDS.tenantA}, 'Load fixture ' || n, array['+1556' || lpad(n::text, 7, '0')], '{}'
    from generate_series(1, 10000) as n`;
  await tdb.admin`analyze contacts`;
});

afterAll(async () => {
  await tdb?.drop();
});

describe('M10-02 local synthetic load baseline', () => {
  it('measures 100 contact searches at the approved 500ms p95 target and records concurrency', async () => {
    const durations: number[] = [];
    const concurrency = 20;
    for (let batch = 0; batch < 5; batch++) {
      const measured = await Promise.all(Array.from({ length: concurrency }, async (_, offset) => {
        const index = batch * concurrency + offset;
        const start = performance.now();
        const result = await searchContacts(
          ctx.ownerA(),
          { q: `Load fixture ${index % 1000 + 1}`, perPage: 10 },
          { db: appDb }
        );
        expect(result.rows.length).toBeGreaterThan(0);
        return performance.now() - start;
      }));
      durations.push(...measured);
    }
    durations.sort((a, b) => a - b);
    const p50 = durations[Math.ceil(durations.length * 0.5) - 1]!;
    const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!;
    const p99 = durations[Math.ceil(durations.length * 0.99) - 1]!;
    console.info(`M10 synthetic local baseline: n=100 concurrency=${concurrency} contacts=10000 p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`);
    expect(p95, `observed p95=${p95.toFixed(1)}ms; the approved target is under 500ms`).toBeLessThan(500);
  }, 60_000);
});
