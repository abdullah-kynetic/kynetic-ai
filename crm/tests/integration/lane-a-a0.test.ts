import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resetEnvCacheForTests } from '@/server/env';
import { QUEUES, stopJobs } from '@/server/jobs';
import { createDb } from '@/server/db/client';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { getReportDetail } from '@/server/reports/reader';
import { generateMonthlyReport } from '@/server/reports';
import { getDashboardMetrics } from '@/server/metrics';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: ReturnType<typeof createDb>;
let reportId: string;
beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true, jobQueues: QUEUES });
  await seedTwoTenants(tdb.admin);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_AUTH: tdb.authUrl,
    DATABASE_URL_WORKER: tdb.urls.worker,
    BETTER_AUTH_SECRET: 'lane-a-integration-secret-not-for-real-use',
    APP_ENCRYPTION_KEY: 'lane-a-integration-key-not-for-real-use',
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false'
  });
  resetEnvCacheForTests();
  db = createDb(tdb.app);
  await tdb.admin`insert into metrics_daily (tenant_id, day, leads, calls, contacts_reached, estimates_booked, won_revenue_cents)
    values (${IDS.tenantA}, '2026-01-10', 10, 14, 7, 4, 120000), (${IDS.tenantA}, '2026-01-11', 5, 6, 3, 2, 30000),
      (${IDS.tenantB}, '2026-01-10', 999, 999, 999, 999, 999999)`;
  const [report] =
    await tdb.admin`insert into reports (tenant_id, kind, period_start, status, storage_key)
    values (${IDS.tenantA}, 'monthly_roi', '2026-01-01', 'ready', ${`${IDS.tenantB}/reports/2026-01-01.json`}) returning id`;
  reportId = report.id;
}, 30000);
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('F-01 F-49 Lane A charts and report totals', () => {
  it('computes monthly fallback totals, rate, daily trend and isolates tenant data', async () => {
    const detail = await getReportDetail(ctx.ownerA(), reportId, { db, storage: null });
    expect(detail?.source).toBe('Computed from daily metrics');
    expect(detail?.content.sections.performance.data).toMatchObject({
      leads: 15,
      calls: 20,
      reached: 10,
      booked: 6,
      bookingRate: 40,
      speedToLeadMinutes: null
    });
    expect(detail?.content.sections.revenue.data.revenueCents).toBe(150000);
    expect(detail?.content.sections.daily.data.days).toHaveLength(2);
    expect(detail?.content.sections.guarantee.data.result).toBe('Not set for this period');
    const dashboard = await getDashboardMetrics(ctx.ownerA(), '2026-01-01', '2026-01-31', { db });
    expect(dashboard.totals).toMatchObject({
      leads: 15,
      calls: 20,
      contactsReached: 10,
      estimatesBooked: 6,
      bookingRate: 40
    });
  });
  it('uses artifact totals and its canonical tenant key even when the stored key is foreign', async () => {
    const storage = new FakeStorage();
    const snapshot = (await getReportDetail(ctx.ownerA(), reportId, { db, storage: null }))!
      .content;
    snapshot.sections.performance.data.leads = 42;
    await storage.put(
      `${IDS.tenantA}/reports/2026-01-01.json`,
      new TextEncoder().encode(JSON.stringify(snapshot))
    );
    const detail = await getReportDetail(ctx.ownerA(), reportId, { db, storage });
    expect(detail?.source).toBe('Generated report');
    expect(detail?.content.sections.performance.data.leads).toBe(42);
  });
  it('does not access storage when the report belongs to another tenant', async () => {
    const storage = new FakeStorage();
    const get = vi.spyOn(storage, 'get');
    expect(await getReportDetail(ctx.ownerB(), reportId, { db, storage })).toBeNull();
    expect(get).not.toHaveBeenCalled();
  });
  it('retains old artifact totals and explicitly computes missing sections', async () => {
    const storage = new FakeStorage();
    await storage.put(
      `${IDS.tenantA}/reports/2026-01-01.json`,
      new TextEncoder().encode(
        JSON.stringify({
          periodStart: '2026-01-01',
          sections: {
            performance: {
              data: { leads: 30, calls: 40, booked: 12, bookingRate: 40, speedToLeadMinutes: 2 }
            },
            revenue: { data: { revenueCents: 500000 } }
          }
        })
      )
    );
    const detail = await getReportDetail(ctx.ownerA(), reportId, { db, storage });
    expect(detail?.source).toContain('additional metrics computed');
    expect(detail?.content.sections.performance.data.leads).toBe(30);
    expect(detail?.content.sections.performance.data.reached).toBe(10);
  });
  it('generates the same totals and serializable trend for future artifacts', async () => {
    const generated = await generateMonthlyReport(ctx.ownerA(), '2026-01-01', { db });
    expect(generated.sections.performance.data).toMatchObject({
      leads: 15,
      reached: 10,
      booked: 6
    });
    expect(generated.sections.daily.data).toMatchObject({
      days: [{ day: '2026-01-10' }, { day: '2026-01-11' }]
    });
  });
  it('surfaces invalid artifacts and storage failures instead of silently masking them', async () => {
    const storage = new FakeStorage();
    await storage.put(`${IDS.tenantA}/reports/2026-01-01.json`, new TextEncoder().encode('{}'));
    await expect(getReportDetail(ctx.ownerA(), reportId, { db, storage })).rejects.toThrow();
    vi.spyOn(storage, 'get').mockRejectedValue(new Error('Storage unavailable'));
    await expect(getReportDetail(ctx.ownerA(), reportId, { db, storage })).rejects.toThrow(
      'Storage unavailable'
    );
  });
  it('allows tenant staff to read the same totals and excludes bookings after report month end', async () => {
    const staff = await getReportDetail(
      { tenantId: IDS.tenantA, userId: IDS.staffA, role: 'staff' },
      reportId,
      { db, storage: null }
    );
    expect(staff?.content.sections.performance.data.leads).toBe(15);
    await tdb.admin`update tenants set guarantee_start_date = '2026-01-25', guarantee_baseline_bookings = 1 where id = ${IDS.tenantA}`;
    const [contact] =
      await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantA} limit 1`;
    await tdb.admin`insert into appointments (tenant_id, contact_id, starts_at, ends_at, booked_by, created_at) values
      (${IDS.tenantA}, ${contact.id}, '2026-01-26T10:00Z', '2026-01-26T11:00Z', 'alex', '2026-01-26T09:00Z'),
      (${IDS.tenantA}, ${contact.id}, '2026-02-02T10:00Z', '2026-02-02T11:00Z', 'alex', '2026-02-01T09:00Z')`;
    const detail = await getReportDetail(ctx.ownerA(), reportId, { db, storage: null });
    expect(detail?.content.sections.guarantee.data.result).toBe('In progress');
  });
});
