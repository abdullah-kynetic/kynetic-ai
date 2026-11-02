import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { searchContacts } from '@/server/contacts';
import postgres from 'postgres';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let appDb: Db;
let appPool: ReturnType<typeof postgres>;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  // Match the app connection pool configured in src/server/db/client.ts.
  appPool = postgres(tdb.urls.app, { max: 10 });
  appDb = createDb(appPool);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full') on conflict (tenant_id, module_key) do update set enabled = true, level = 'full'`;
  await tdb.admin`insert into contacts (tenant_id, first_name, phones, emails)
    select ${IDS.tenantA}, 'Load fixture ' || n, array['+1556' || lpad(n::text, 7, '0')], '{}'
    from generate_series(1, 10000) as n`;
  await tdb.admin`analyze contacts`;
  const plan = await tdb.admin`
    explain (analyze, buffers, format text)
    select count(*) from contacts
    where tenant_id = ${IDS.tenantA} and deleted_at is null and merged_into_id is null
      and ((first_name || ' ' || coalesce(last_name, '')) ilike '%Load fixture 4321%'
        or primary_email ilike '%Load fixture 4321%'
        or regexp_replace(contacts_phones_search(phones), '[^0-9]', '', 'g') like '%15560004321%')`;
  console.info(
    `M10 search plan (app-equivalent pool max=10): ${plan.map((r) => r['QUERY PLAN']).join(' | ')}`
  );
  const phonePlan = await tdb.admin`
    explain (analyze, buffers, format text)
    select id from contacts
    where tenant_id = ${IDS.tenantA} and deleted_at is null
      and regexp_replace(contacts_phones_search(phones), '[^0-9]', '', 'g') like '%15560004321%'`;
  const phonePlanText = phonePlan.map((r) => r['QUERY PLAN']).join('\n');
  console.info(`M10 phone-fragment plan: ${phonePlanText.replaceAll('\n', ' | ')}`);
  expect(phonePlanText).toContain('contacts_phone_fragment_trgm');
});

afterAll(async () => {
  await appPool?.end();
  await tdb?.drop();
});

// The decided target (DC-033) is 500 ms. Shared CI runners are slower than the local baseline machine,
// so CI sets LOAD_P95_MS to a looser limit (decided 2026-11-02); the product target is unchanged.
const P95_LIMIT_MS = Number(process.env.LOAD_P95_MS ?? 500);

describe('M10-02 local synthetic load baseline', () => {
  it('measures 100 contact searches at concurrency 20 and 100 against the approved p95 target', async () => {
    for (const concurrency of [20, 100]) {
      const durations: number[] = [];
      for (let batch = 0; batch < 100 / concurrency; batch++) {
        const measured = await Promise.all(
          Array.from({ length: concurrency }, async (_, offset) => {
            const index = batch * concurrency + offset;
            const start = performance.now();
            const result = await searchContacts(
              ctx.ownerA(),
              { q: `Load fixture ${(index % 1000) + 1}`, perPage: 10 },
              { db: appDb }
            );
            expect(result.rows.length).toBeGreaterThan(0);
            return performance.now() - start;
          })
        );
        durations.push(...measured);
      }
      durations.sort((a, b) => a - b);
      const p50 = durations[Math.ceil(durations.length * 0.5) - 1]!;
      const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!;
      const p99 = durations[Math.ceil(durations.length * 0.99) - 1]!;
      console.info(
        `M10 synthetic local baseline: n=100 concurrency=${concurrency} pool=10 contacts=10000 p50=${p50.toFixed(1)}ms p95=${p95.toFixed(1)}ms p99=${p99.toFixed(1)}ms`
      );
      expect(
        p95,
        `concurrency=${concurrency}, observed p95=${p95.toFixed(1)}ms; limit is under ${P95_LIMIT_MS}ms`
      ).toBeLessThan(P95_LIMIT_MS);
    }
  }, 60_000);
});
