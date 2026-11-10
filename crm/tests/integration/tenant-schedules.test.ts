import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { resetEnvCacheForTests } from '@/server/env';
import { stopJobs } from '@/server/jobs';
import { rollupMetricsDaily } from '@/server/metrics';
import { setReportDay } from '@/server/admin/report-schedule';
import { runMetricsFanout, runReportFanout } from '@/server/schedules';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let test: TestDatabase;
let worker: Db;

beforeAll(async () => {
  test = await createTestDatabase({ jobs: true });
  await seedTwoTenants(test.admin);
  await test.admin`update tenants set status = 'suspended' where id = ${IDS.tenantB}`;
  Object.assign(process.env, {
    APP_BASE_URL: 'https://portal.example.test',
    DATABASE_URL: test.urls.app,
    DATABASE_URL_WORKER: test.urls.worker,
    DATABASE_URL_AUTH: test.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32),
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false'
  });
  resetEnvCacheForTests();
  await stopJobs();
  worker = createDb(test.worker);
});

afterAll(async () => {
  await stopJobs();
  await test?.drop();
});

describe('per-tenant metrics and report schedules', () => {
  it('enqueues rollups only for operating tenants and isolates the rebuild', async () => {
    const first = await runMetricsFanout({
      db: worker,
      now: new Date('2026-11-05T18:00:00Z')
    });
    const second = await runMetricsFanout({
      db: worker,
      now: new Date('2026-11-05T18:00:00Z')
    });
    expect(first.queued).toBe(2);
    expect(second.queued).toBe(0);
    const jobs = await test.admin`
      select data from pgboss.job where name = 'metrics.daily' order by created_on`;
    expect(jobs.map((job) => job.data)).toEqual([
      { tenantId: IDS.tenantA, day: '2026-11-05' },
      { tenantId: IDS.tenantA, day: '2026-11-04' }
    ]);
    await rollupMetricsDaily({ tenantId: IDS.tenantA, day: '2026-11-04' }, { db: worker });
    const rows = await test.admin`
      select tenant_id from metrics_daily where day = '2026-11-04'`;
    expect(rows).toEqual([{ tenant_id: IDS.tenantA }]);
  });

  it('enqueues the monthly report on the configured local day and skips a sent report', async () => {
    await expect(
      setReportDay({ id: IDS.ownerA, kyneticRole: null }, IDS.tenantA, 5, { db: worker })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await setReportDay({ id: IDS.admin, kyneticRole: 'admin' }, IDS.tenantA, 5, { db: worker });
    const early = await runReportFanout({
      db: worker,
      now: new Date('2026-11-04T18:00:00Z')
    });
    expect(early.queued).toBe(0);
    const due = await runReportFanout({
      db: worker,
      now: new Date('2026-11-05T18:00:00Z')
    });
    expect(due.queued).toBe(1);
    const again = await runReportFanout({
      db: worker,
      now: new Date('2026-11-05T19:00:00Z')
    });
    expect(again.queued).toBe(0);
    const jobs = await test.admin`
      select data from pgboss.job where name = 'report.monthly'`;
    expect(jobs).toEqual([{ data: { tenantId: IDS.tenantA, periodStart: '2026-10-01' } }]);
    await test.admin`
      insert into reports (tenant_id, kind, period_start, status)
      values (${IDS.tenantA}, 'monthly_roi', '2026-10-01', 'sent')`;
    await test.admin`delete from pgboss.job where name = 'report.monthly'`;
    const sent = await runReportFanout({
      db: worker,
      now: new Date('2026-11-05T20:00:00Z')
    });
    expect(sent.queued).toBe(0);
    const other = await test.admin`
      select config->>'reportDayOfMonth' as day from tenant_modules
      where tenant_id = ${IDS.tenantB} and module_key = 'platform'`;
    expect(other[0]?.day ?? null).toBeNull();
    expect(ctx.ownerA().tenantId).toBe(IDS.tenantA);
  });
});
