import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { listUsageMonth, setLlmMonthlyCap } from '@/server/admin';
import { FakeLlmProvider } from '@/server/adapters/llm/fake';
import { setLlmProvider } from '@/server/adapters/llm';
import { LlmCapReachedError, runLlmTask } from '@/server/llm';
import { resetEnvCacheForTests } from '@/server/env';
import { rollupUsageDaily } from '@/server/usage';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let workerDb: Db;
let fake: FakeLlmProvider;
const platform = { userId: IDS.admin, role: 'admin' as const };
const input = (tenantId: string) => ({
  tenantId,
  task: 'call_summary' as const,
  messages: [{ role: 'user' as const, content: 'summarize' }]
});

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  workerDb = createDb(tdb.worker);
  Object.assign(process.env, {
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_AUTH: tdb.authUrl,
    APP_BASE_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real',
    LLM_ENABLED: 'true',
    PROVIDER_MODE: 'stub',
    LLM_MODELS: JSON.stringify({ call_summary: 'test/cheap' })
  });
  resetEnvCacheForTests();
});
afterAll(async () => {
  setLlmProvider(undefined);
  await stopJobs();
  await tdb?.drop();
});
beforeEach(async () => {
  fake = new FakeLlmProvider();
  fake.costMicros = 6_000;
  setLlmProvider(fake);
  await tdb.admin`delete from llm_usage`;
  await tdb.admin`delete from staff_notifications where kind = 'spend_cap'`;
  await tdb.admin`update tenants set llm_monthly_cap_cents = null`;
});

const month = new Date().toISOString().slice(0, 10);

describe('P5-2 a call is metered and shown on the usage page data', () => {
  it('records tokens and cost, rolls up, and appears in the admin usage rows', async () => {
    await runLlmTask(input(IDS.tenantA), { db });
    const rows = await tdb.admin`select task, model, cost_micros, status from llm_usage`;
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      task: 'call_summary',
      model: 'test/cheap',
      cost_micros: '6000'
    });
    await rollupUsageDaily({ tenantId: IDS.tenantA, day: month }, { db: workerDb });
    const { rows: usage } = await listUsageMonth(platform, month.slice(0, 7), { db });
    const a = usage.find((r) => r.tenantId === IDS.tenantA)!;
    const b = usage.find((r) => r.tenantId === IDS.tenantB)!;
    expect(a.llmCostMicros).toBe(6000);
    expect(b.llmCostMicros).toBe(0);
  });

  it('records a failed call with no cost so it is visible', async () => {
    const { ProviderError } = await import('@/server/adapters/errors');
    fake.failWith = new ProviderError('transient', 'network', 'down');
    await expect(runLlmTask(input(IDS.tenantA), { db })).rejects.toThrow('down');
    const rows = await tdb.admin`select status, cost_micros from llm_usage`;
    expect(rows[0]).toMatchObject({ status: 'failed', cost_micros: '0' });
  });

  it('the runtime role cannot edit or delete usage rows', async () => {
    await runLlmTask(input(IDS.tenantA), { db });
    await expect(tdb.app`update llm_usage set cost_micros = 0`).rejects.toThrow();
    await expect(tdb.app`delete from llm_usage`).rejects.toThrow();
  });
});

describe('P5-3 a client over its cap gets no further calls and the admin is told', () => {
  it('stops at the cap, notifies once, and leaves other clients alone', async () => {
    await setLlmMonthlyCap(platform, IDS.tenantA, 1, { db }); // 1 cent = 10,000 micros
    await runLlmTask(input(IDS.tenantA), { db });
    await runLlmTask(input(IDS.tenantA), { db }); // 12,000 micros spent now
    await expect(runLlmTask(input(IDS.tenantA), { db })).rejects.toBeInstanceOf(LlmCapReachedError);
    await expect(runLlmTask(input(IDS.tenantA), { db })).rejects.toBeInstanceOf(LlmCapReachedError);
    expect(fake.calls).toHaveLength(2);
    const notes =
      await tdb.admin`select title, link from staff_notifications where kind = 'spend_cap'`;
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ title: 'AI spend cap reached', link: '/admin/usage' });
    await runLlmTask(input(IDS.tenantB), { db });
    expect(fake.calls).toHaveLength(3);
  });

  it('a cap of zero blocks everything, and a blank cap uses the platform default', async () => {
    await setLlmMonthlyCap(platform, IDS.tenantA, 0, { db });
    await expect(runLlmTask(input(IDS.tenantA), { db })).rejects.toBeInstanceOf(LlmCapReachedError);
    expect(fake.calls).toHaveLength(0);
    await setLlmMonthlyCap(platform, IDS.tenantA, null, { db });
    await runLlmTask(input(IDS.tenantA), { db }); // default is 500 cents
    expect(fake.calls).toHaveLength(1);
  });

  it('only an admin can set the cap', async () => {
    await expect(
      setLlmMonthlyCap({ userId: IDS.va, role: 'va' }, IDS.tenantA, 5, { db })
    ).rejects.toThrow();
  });
});
