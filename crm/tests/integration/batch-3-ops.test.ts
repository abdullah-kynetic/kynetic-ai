import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { FakeStorage } from '@/server/adapters/storage/fake';
import {
  listUsageMonth,
  offboardTenant,
  readOutboundPause,
  setMonthlySpendCap,
  setOutboundPaused
} from '@/server/admin';
import { noteExhaustedJob, publishAdminDigest } from '@/server/admin/alerts';
import { runTenantExport } from '@/server/admin/tenant-export';
import { createDb, type Db } from '@/server/db/client';
import { AppError } from '@/server/errors';
import { resetEnvCacheForTests } from '@/server/env';
import { stopJobs } from '@/server/jobs';
import { checkOutbound } from '@/server/outbound';
import { getDashboardMetrics } from '@/server/metrics';
import { deliverReportReadyEmail } from '@/server/reports/ready-email';
import { sendWeeklyClientEmail } from '@/server/reports/weekly-email';
import { rollupUsageDaily } from '@/server/usage';
import { assertDevLeadHook } from '@/server/leads/dev-policy';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let workerDb: Db;
const admin = { userId: IDS.admin, role: 'admin' as const };
const va = { userId: IDS.va, role: 'va' as const };
const gateCtx = { tenantId: IDS.tenantA, role: 'system' as const };
let contactA = '';

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  const seeded = await seedTwoTenants(tdb.admin);
  contactA = seeded.a.contactId;
  db = createDb(tdb.app);
  workerDb = createDb(tdb.worker);
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    APP_BASE_URL: 'https://dev.kyneticai.com',
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real',
    OUTBOUND_ENABLED: 'false',
    ADMIN_ALERT_EMAIL_ENABLED: 'false',
    CLIENT_EMAIL_ENABLED: 'false'
  });
  resetEnvCacheForTests();
});

afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('global pause, spend cap, and offboarding', () => {
  it('lets the env switch win over a portal pause', async () => {
    await setOutboundPaused(admin, true, 'maintenance', { db });
    const state = await readOutboundPause(admin, { db });
    expect(state.paused).toBe(true);
    expect(state.envEnabled).toBe(false);
    const paused = await checkOutbound(
      gateCtx,
      { contactId: contactA, channel: 'sms', module: 'alex_core' },
      new Date('2026-11-10T18:00:00Z'),
      { db, outboundEnabled: true }
    );
    expect(paused).toEqual({ allowed: false, reason: 'global_pause' });
    const envOff = await checkOutbound(
      gateCtx,
      { contactId: contactA, channel: 'phone_call', module: 'alex_core' },
      new Date('2026-11-10T18:00:00Z'),
      { db, outboundEnabled: false }
    );
    expect(envOff).toEqual({ allowed: false, reason: 'outbound_disabled' });
    await setOutboundPaused(admin, false, '', { db });
  });

  it('blocks new calls at the spend cap and tells admins once', async () => {
    await setMonthlySpendCap(admin, IDS.tenantA, 0, { db });
    const call = await checkOutbound(
      gateCtx,
      { contactId: contactA, channel: 'phone_call', module: 'alex_core' },
      new Date('2026-11-10T18:00:00Z'),
      { db, outboundEnabled: true }
    );
    expect(call).toEqual({ allowed: false, reason: 'spend_cap' });
    const text = await checkOutbound(
      gateCtx,
      { contactId: contactA, channel: 'sms', module: 'alex_core' },
      new Date('2026-11-10T18:00:00Z'),
      { db, outboundEnabled: true }
    );
    expect(text.allowed).toBe(false);
    if (!text.allowed) expect(text.reason).not.toBe('spend_cap');
    const again = await checkOutbound(
      gateCtx,
      { contactId: contactA, channel: 'phone_call', module: 'alex_core' },
      new Date('2026-11-10T18:00:00Z'),
      { db, outboundEnabled: true }
    );
    expect(again).toEqual({ allowed: false, reason: 'spend_cap' });
    const notes = await tdb.admin`
      select count(*)::int as n from staff_notifications
      where dedupe_key = ${'spend-cap:' + IDS.tenantA + ':2026-11'}`;
    expect(notes[0].n).toBe(1);
    await expect(setMonthlySpendCap(va, IDS.tenantA, 10, { db })).rejects.toBeInstanceOf(AppError);
    await setMonthlySpendCap(admin, IDS.tenantA, null, { db });
  });

  it('suspends without the offboard marker as tenant_suspended', async () => {
    await tdb.admin`update tenants set status = 'suspended' where id = ${IDS.tenantB}`;
    const decision = await checkOutbound(
      { tenantId: IDS.tenantB, role: 'system' },
      {
        contactId: (
          await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantB} limit 1`
        )[0].id,
        channel: 'phone_call',
        module: 'alex_core'
      },
      new Date('2026-11-10T18:00:00Z'),
      { db, outboundEnabled: true }
    );
    expect(decision).toEqual({ allowed: false, reason: 'tenant_suspended' });
    await tdb.admin`update tenants set status = 'active' where id = ${IDS.tenantB}`;
  });

  it('offboards once, stops sends, and exports only that client', async () => {
    await expect(offboardTenant(va, IDS.tenantA, 'tenant-a', { db })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(offboardTenant(admin, IDS.tenantA, 'nope', { db })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    const first = await offboardTenant(admin, IDS.tenantA, 'tenant-a', { db });
    const second = await offboardTenant(admin, IDS.tenantA, 'tenant-a', { db });
    expect(first.firstTime).toBe(true);
    expect(second.firstTime).toBe(false);
    expect(second.deletionDueOn).toBe(first.deletionDueOn);
    expect(second.exportId).toBe(first.exportId);
    const decision = await checkOutbound(
      gateCtx,
      { contactId: contactA, channel: 'phone_call', module: 'alex_core' },
      new Date('2026-11-10T18:00:00Z'),
      { db, outboundEnabled: true }
    );
    expect(decision).toEqual({ allowed: false, reason: 'tenant_kill' });
    const tokens = await tdb.admin`
      select count(*)::int as n from service_tokens
      where tenant_id = ${IDS.tenantA} and revoked_at is null`;
    expect(tokens[0].n).toBe(0);
    await tdb.admin`update contacts set first_name = '=1+1' where id = ${contactA}`;
    const storage = new FakeStorage();
    await runTenantExport(
      { tenantId: IDS.tenantA, exportId: first.exportId },
      { db: workerDb, storage }
    );
    const [saved] = await tdb.admin`
      select storage_key, status from tenant_exports where id = ${first.exportId}`;
    expect(saved.status).toBe('ready');
    const file = await storage.get(saved.storage_key);
    const text = new TextDecoder().decode(file?.body ?? new Uint8Array());
    expect(text).toContain('contacts.csv');
    expect(text).toContain("'=1+1");
    expect(text).toContain('Company a');
    expect(text).not.toContain('Contact b');
    expect(text).not.toContain('Company b');
    expect(text).not.toContain('recording');
  });
});

describe('usage, alerts, and emails that stay off', () => {
  it('rolls usage up for one tenant and hides the other tenant from that read', async () => {
    await tdb.admin`
      insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, duration_s, cost_cents)
      values (${IDS.tenantB}, (select id from contacts where tenant_id = ${IDS.tenantB} limit 1),
        'fake', 'usage-b', 'outbound', '2026-11-10T12:00:00Z', 30, 99)`;
    await rollupUsageDaily({ tenantId: IDS.tenantA, day: '2026-11-10' }, { db: workerDb });
    const own = await tdb.app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${IDS.tenantA}, true), set_config('app.role', 'owner', true)`;
      return tx`select tenant_id from usage_daily where day = '2026-11-10'`;
    });
    expect(own.every((row) => row.tenant_id === IDS.tenantA)).toBe(true);
    const listed = await listUsageMonth(va, '2026-11', { db });
    const a = listed.rows.find((row) => row.tenantId === IDS.tenantA);
    expect(a?.callCount).toBeGreaterThan(0);
    expect(a?.monthlyFeeCents).toBe(150000);
  });

  it('does not email the digest or a failed job unless the flag is on', async () => {
    const quiet = new FakeEmailProvider();
    const created = await publishAdminDigest(new Date('2026-11-10T16:00:00Z'), {
      db,
      provider: quiet
    });
    expect(created.created).toBe(true);
    expect(quiet.sent).toHaveLength(0);
    process.env.ADMIN_ALERT_EMAIL_ENABLED = 'true';
    resetEnvCacheForTests();
    try {
      const loud = new FakeEmailProvider();
      const note = await noteExhaustedJob(
        {
          queue: 'usage.daily',
          error: new Error('boom owner-a@example.test'),
          payload: { tenantId: IDS.tenantA, phone: '+15555550101' },
          now: new Date('2026-11-10T16:10:00Z')
        },
        { db, provider: loud }
      );
      expect(note.notified).toBe(true);
      expect(loud.sent.map((mail) => mail.to)).toEqual(['admin@example.test']);
      expect(loud.sent[0].text).not.toContain('owner-a@example.test');
      expect(loud.sent[0].text).not.toContain('+15555550101');
      const again = await noteExhaustedJob(
        {
          queue: 'usage.daily',
          error: new Error('boom again'),
          payload: {},
          now: new Date('2026-11-10T16:40:00Z')
        },
        { db, provider: loud }
      );
      expect(again.notified).toBe(false);
      expect(loud.sent).toHaveLength(1);
    } finally {
      process.env.ADMIN_ALERT_EMAIL_ENABLED = 'false';
      resetEnvCacheForTests();
    }
  });

  it('sends weekly numbers that match the dashboard, and stays quiet when the flag is off', async () => {
    await tdb.admin`
      insert into metrics_daily (tenant_id, day, leads, calls, contacts_reached, estimates_booked, won_revenue_cents)
      values (${IDS.tenantA}, '2026-11-02', 2, 3, 1, 4, 500)
      on conflict (tenant_id, day) do update
        set leads = 2, calls = 3, contacts_reached = 1, estimates_booked = 4, won_revenue_cents = 500`;
    const range = { from: '2026-11-02', to: '2026-11-08' };
    const dashboard = await getDashboardMetrics(
      { tenantId: IDS.tenantA, role: 'system' },
      range.from,
      range.to,
      { db }
    );
    const blocked = new FakeEmailProvider();
    expect(
      await sendWeeklyClientEmail(
        { tenantId: IDS.tenantA, ...range },
        { db, provider: blocked, envEnabled: false }
      )
    ).toEqual({ sent: 0 });
    expect(blocked.sent).toHaveLength(0);
    await tdb.admin`update tenants set weekly_email_enabled = true where id = ${IDS.tenantA}`;
    const provider = new FakeEmailProvider();
    const sent = await sendWeeklyClientEmail(
      { tenantId: IDS.tenantA, ...range },
      { db, provider, envEnabled: true }
    );
    expect(sent.sent).toBe(1);
    expect(provider.sent[0].text).toContain(`New leads: ${dashboard.totals.leads}.`);
    expect(provider.sent[0].text).toContain(`Calls: ${dashboard.totals.calls}.`);
    expect(provider.sent[0].text).toContain(
      `Estimates booked: ${dashboard.totals.estimatesBooked}.`
    );
    expect(provider.sent[0].subject).toContain(String(dashboard.totals.estimatesBooked));
    await tdb.admin`update tenants set weekly_email_enabled = false where id = ${IDS.tenantA}`;
  });

  it('does not email a report link when the client flag is off', async () => {
    const provider = new FakeEmailProvider();
    const quiet = await deliverReportReadyEmail(
      {
        tenantId: IDS.tenantA,
        reportId: '33333333-3333-4333-8333-333333333333',
        periodStart: '2026-10-01'
      },
      { db, provider, envEnabled: true }
    );
    expect(quiet).toEqual({ sent: 0 });
    await tdb.admin`update tenants set report_email_enabled = true where id = ${IDS.tenantA}`;
    const sent = await deliverReportReadyEmail(
      {
        tenantId: IDS.tenantA,
        reportId: '33333333-3333-4333-8333-333333333333',
        periodStart: '2026-10-01'
      },
      { db, provider, envEnabled: true }
    );
    expect(sent.sent).toBe(1);
    expect(provider.sent[0].text).toContain(
      '/dashboard/reports/33333333-3333-4333-8333-333333333333'
    );
    expect(provider.sent[0].text).not.toContain('Contact');
    const off = await deliverReportReadyEmail(
      {
        tenantId: IDS.tenantA,
        reportId: '44444444-4444-4444-8444-444444444444',
        periodStart: '2026-09-01'
      },
      { db, provider, envEnabled: false }
    );
    expect(off).toEqual({ sent: 0 });
  });

  it('refuses the dev lead hook in production before any intake work', () => {
    expect(() => assertDevLeadHook('production')).toThrow(/dev-only/);
    expect(() => assertDevLeadHook('test')).not.toThrow();
  });
});
