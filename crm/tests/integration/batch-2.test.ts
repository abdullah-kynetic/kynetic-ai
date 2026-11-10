import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import type { Actor } from '@/server/auth/permissions';
import { searchContacts } from '@/server/contacts';
import { bookAppointment } from '@/server/appointments';
import { automationHistory } from '@/server/automations/history';
import { getDashboardMetrics } from '@/server/metrics';
import { generateMonthlyReport } from '@/server/reports';
import {
  getOwnSupportThread,
  getStaffSupportThread,
  listOwnSupportRequests,
  listSupportAlerts,
  listSupportQueue,
  replyAsStaff,
  replyToOwnSupportRequest,
  submitSupportRequest
} from '@/server/support';
import { recordAcceptance } from '@/server/terms';
import { withTenant } from '@/server/tenancy';
import { notifications } from '@/server/db/schema';
import { eq } from 'drizzle-orm';
import { QUEUES } from '@/server/jobs';
import { resetEnvCacheForTests } from '@/server/env';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: ReturnType<typeof createDb>;
const ownerA: Actor = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'owner', canExport: true, canBulkDelete: true },
  viewAs: null
};
const ownerB: Actor = {
  userId: IDS.ownerB,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantB, role: 'owner', canExport: true, canBulkDelete: true },
  viewAs: null
};
const viewing: Actor = {
  userId: IDS.admin,
  kyneticRole: 'admin',
  membership: null,
  viewAs: { tenantId: IDS.tenantA, write: false }
};
const admin = { userId: IDS.admin, role: 'admin' as const };

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true, jobQueues: QUEUES });
  await seedTwoTenants(tdb.admin);
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.BETTER_AUTH_SECRET = 'integration-only-secret-not-for-real-use';
  process.env.APP_ENCRYPTION_KEY = 'integration-only-encryption-key-not-real';
  process.env.PROVIDER_MODE = 'stub';
  process.env.OUTBOUND_ENABLED = 'false';
  resetEnvCacheForTests();
  db = createDb(tdb.app);
});
afterAll(async () => tdb?.drop());

describe('dashboard matches the monthly report', () => {
  it('uses the same totals, booking rate, and speed-to-lead for one month', async () => {
    await tdb.admin`
      insert into metrics_daily (tenant_id, day, leads, calls, contacts_reached, estimates_booked, won_revenue_cents)
      values
        (${IDS.tenantA}, '2026-01-10', 2, 1, 1, 1, 1000),
        (${IDS.tenantA}, '2026-01-11', 2, 1, 1, 1, 500)`;
    const [deal] = await tdb.admin`select id from deals where tenant_id = ${IDS.tenantA} limit 1`;
    const [first] = await tdb.admin`
      insert into contacts (tenant_id, first_name, source, phones, emails, created_at)
      values (${IDS.tenantA}, 'Lead one', 'form', ${['+15555550121']}, ${['one@example.test']}, '2026-01-10T00:00:00Z')
      returning id`;
    const [second] = await tdb.admin`
      insert into contacts (tenant_id, first_name, source, phones, emails, created_at)
      values (${IDS.tenantA}, 'Lead two', 'form', ${['+15555550122']}, ${['two@example.test']}, '2026-01-11T00:00:00Z')
      returning id`;
    await tdb.admin`
      insert into contacts (tenant_id, first_name, source, imported_source, phones, emails, created_at)
      values (${IDS.tenantA}, 'Imported', 'form', 'csv_other', ${['+15555550123']}, ${['imp@example.test']}, '2026-01-10T00:00:00Z')`;
    await tdb.admin`
      insert into calls (tenant_id, contact_id, deal_id, provider, provider_call_id, direction, started_at)
      values
        (${IDS.tenantA}, ${first.id}, ${deal.id}, 'fake', 'stl-1', 'outbound', '2026-01-10T00:30:00Z'),
        (${IDS.tenantA}, ${second.id}, ${deal.id}, 'fake', 'stl-2', 'outbound', '2026-01-11T01:30:00Z')`;

    const dashboard = await getDashboardMetrics(ctx.ownerA(), '2026-01-01', '2026-01-31', { db });
    const report = await generateMonthlyReport(ctx.ownerA(), '2026-01-01', { db });
    const performance = report.sections.performance.data as {
      leads: number;
      calls: number;
      booked: number;
      bookingRate: number;
      speedToLeadMinutes: number;
    };
    expect(dashboard.totals.leads).toBe(performance.leads);
    expect(dashboard.totals.calls).toBe(performance.calls);
    expect(dashboard.totals.estimatesBooked).toBe(performance.booked);
    expect(dashboard.totals.revenueCents).toBe(
      (report.sections.revenue.data as { revenueCents: number }).revenueCents
    );
    expect(dashboard.totals.bookingRate).toBe(performance.bookingRate);
    expect(dashboard.totals.speedToLeadMinutes).toBe(performance.speedToLeadMinutes);
    expect(dashboard.totals.bookingRate).toBe(50);
    expect(dashboard.totals.speedToLeadMinutes).toBe(60);
  });
});

describe('support threads', () => {
  it('keeps threads inside the tenant and alerts staff in the app only', async () => {
    const created = await submitSupportRequest(
      ctx.ownerA(),
      ownerA,
      { subject: 'Alex change', body: 'Ask for the budget earlier.', category: 'alex_change' },
      { db }
    );
    const own = await getOwnSupportThread(ctx.ownerA(), ownerA, created.id, { db });
    expect(own?.category).toBe('alex_change');
    expect(await getOwnSupportThread(ctx.ownerB(), ownerB, created.id, { db })).toBeNull();

    const alerts = await listSupportAlerts(admin, { db });
    expect(alerts.some((alert) => alert.link === `/admin/support/${created.id}`)).toBe(true);
    const hidden = await withTenant(
      ctx.ownerA(),
      async (tx) => {
        const rows = await tx
          .select({ kind: notifications.kind })
          .from(notifications)
          .where(eq(notifications.kind, 'support_request'));
        return rows.length;
      },
      { db }
    );
    expect(hidden).toBeGreaterThan(0);

    const filtered = await listSupportQueue(admin, { db, category: 'alex_change' });
    expect(filtered.map((row) => row.id)).toContain(created.id);
    expect(filtered.every((row) => row.category === 'alex_change')).toBe(true);

    await replyToOwnSupportRequest(ctx.ownerA(), ownerA, created.id, 'One more detail.', { db });
    const reply = await replyAsStaff(admin, created.id, 'We can change that.', { db });
    const thread = await getStaffSupportThread(admin, created.id, { db });
    expect(thread?.messages.map((message) => message.authorSide)).toEqual(['client', 'kynetic']);
    const note = await tdb.admin`
      select kind, user_id from notifications
      where link = ${`/dashboard/support/${created.id}`} and kind = 'support_reply'`;
    expect(note).toEqual([{ kind: 'support_reply', user_id: IDS.ownerA }]);
    expect(reply.id).toBeTruthy();
    const audits = await tdb.admin`
      select action from audit_log where entity_id = ${created.id} and action in ('support.reply', 'support.view')
      order by created_at`;
    expect(audits.map((row) => row.action)).toEqual([
      'support.reply',
      'support.reply',
      'support.view'
    ]);

    await expect(
      submitSupportRequest(ctx.ownerA(), viewing, { subject: 'Nope', body: 'Blocked' }, { db })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const denied = await tdb.admin`
      select action from audit_log where action = 'viewas.write_denied' and tenant_id = ${IDS.tenantA}`;
    expect(denied.length).toBeGreaterThan(0);

    const listed = await listOwnSupportRequests(ctx.ownerA(), ownerA, { db });
    expect(listed.find((row) => row.id === created.id)?.status).toBe('open');
  });

  it('records the terms user agent and ignores another tenant contact in search', async () => {
    await recordAcceptance(IDS.ownerB, '203.0.113.8', { db, userAgent: 'Batch2Test/1' });
    const rows = await tdb.admin`
      select user_agent from terms_acceptances where user_id = ${IDS.ownerB} and document = 'terms'`;
    expect(rows[0]?.user_agent).toBe('Batch2Test/1');

    await tdb.admin`update tenants set business_hours = ${tdb.admin.json({
      mon: [{ open: '08:00', close: '17:00' }]
    })} where id = ${IDS.tenantA}`;
    const found = await searchContacts(ctx.ownerA(), { q: 'Contact', perPage: 10 }, { db });
    expect(found.rows.map((row) => row.firstName)).toContain('Contact a');
    expect(found.rows.map((row) => row.firstName)).not.toContain('Contact b');
    const [foreign] =
      await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantB} limit 1`;
    await expect(
      bookAppointment(
        ctx.ownerA(),
        {
          contactId: foreign.id,
          startsAt: new Date('2026-11-16T18:00:00.000Z'),
          endsAt: new Date('2026-11-16T19:00:00.000Z')
        },
        { db, bookedBy: 'user' }
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('summarizes automation runs without editing them', async () => {
    const history = await automationHistory(ctx.ownerA(), 'speed_to_lead', { db });
    expect(history.summary.runs).toBeGreaterThan(0);
    expect(history.runs[0]?.steps.length).toBeGreaterThan(0);
    expect(history.runs[0]?.steps[0]?.channel).toBe('sms');
  });
});
