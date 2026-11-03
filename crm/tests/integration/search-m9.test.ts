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
    values (${IDS.tenantA}, 'crm', true, 'full')`;
  await tdb.admin`insert into contacts (tenant_id, first_name, phones, emails)
    select ${IDS.tenantA}, 'Search fixture ' || n, array['+1555' || lpad(n::text, 7, '0')], '{}'
    from generate_series(1, 10000) as n`;
  await tdb.admin`analyze contacts`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantB}, 'crm', true, 'full')`;
});
afterAll(async () => {
  await tdb?.drop();
});

describe('F-37 global contact search', () => {
  it('finds phone fragments within a 10,000-contact tenant under 500 ms p95 and never crosses tenants', async () => {
    const times: number[] = [];
    let found = false;
    for (let i = 0; i < 20; i++) {
      const start = performance.now();
      const result = await searchContacts(
        ctx.ownerA(),
        { q: '5550004321', perPage: 10 },
        { db: appDb }
      );
      times.push(performance.now() - start);
      found ||= result.rows.some((row) => row.id && row.firstName === 'Search fixture 4321');
    }
    times.sort((a, b) => a - b);
    expect(found, `phone fragment search did not return a row; query=5550004321`).toBe(true);
    expect(times[Math.ceil(times.length * 0.95) - 1]).toBeLessThan(500);
    const foreign = await searchContacts(ctx.ownerA(), { q: '5550102' }, { db: appDb });
    expect(foreign.rows).toHaveLength(0);
  }, 20_000);
});
