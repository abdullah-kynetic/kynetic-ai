import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createDb } from '@/server/db/client';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { enqueue, stopJobs } from '@/server/jobs';
import { registerOutboundCallSubscriber, OUTBOUND_SUBSCRIBER_ID } from '@/server/calls/outbound';
import {
  handleLeadIntake,
  issueLeadWebhookSecret,
  registerLeadProcessor,
  signLeadBody
} from '@/server/leads';
import { parseDevLead } from '@/server/leads/dev-intake';
import {
  bookDevSyntheticAppointment,
  DEV_LEAD_QUEUE,
  DEV_LEAD_SUBSCRIBER,
  devRetryScheduler,
  registerDevLeadSubscriber,
  runDevLeadJob,
  type DevLeadJob
} from '@/server/leads/dev-chain';
import { clearWebhookProcessors, processWebhookEvent } from '@/server/webhooks';
import { withTenant } from '@/server/tenancy';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let database: TestDatabase;
let workerDb: ReturnType<typeof createDb>;
let job: DevLeadJob;
let envelope: EventEnvelope;
const genericQueue = vi.fn(async () => 'unexpected-generic-job') as unknown as typeof enqueue;
const phone = '+' + ['1', '555', '555', '0101'].join('');
const config = {
  APP_BASE_URL: 'https://dev.kyneticai.com',
  TEST_PHONE: phone,
  OUTBOUND_ENABLED: false
};
// Thursday 10:00 PST: explicitly inside this fixture's 09:00–17:00 business day.
const midday = new Date('2026-11-05T18:00:00Z');
const bookingHours = { thu: [{ open: '09:00', close: '17:00' }] };

beforeAll(async () => {
  database = await createTestDatabase({ jobs: true });
  await seedTwoTenants(database.admin);
  // Seeded tenants otherwise have empty hours (closed); configure only this test tenant.
  await database.admin`update tenants set business_hours = ${database.admin.json(bookingHours)} where id = ${IDS.tenantA}`;
  workerDb = createDb(database.worker);
  process.env.APP_BASE_URL = config.APP_BASE_URL;
  process.env.TEST_PHONE = phone;
  process.env.DATABASE_URL = database.urls.app;
  process.env.DATABASE_URL_WORKER = database.urls.worker;
  process.env.DATABASE_URL_AUTH = database.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  process.env.PROVIDER_MODE = 'stub';
  process.env.OUTBOUND_ENABLED = 'false';
  clearSubscribers();
  clearWebhookProcessors();
  registerLeadProcessor();
  registerOutboundCallSubscriber({ queue: genericQueue });
  registerDevLeadSubscriber({ baseUrl: config.APP_BASE_URL });
  const secret = await issueLeadWebhookSecret(IDS.tenantA, { db: workerDb });
  const lead = {
    externalId: 'DEV-real-db-chain',
    source: 'dev_codex',
    synthetic: true,
    businessState: 'CA',
    phone,
    projectType: 'Synthetic roof',
    budget: 'Synthetic budget',
    consent: { capturedText: 'Synthetic test consent; no actual call.' }
  };
  const raw = JSON.stringify(lead);
  const timestamp = Math.floor(Date.now() / 1000);
  const request = () =>
    new Request(config.APP_BASE_URL + '/api/hooks/leads/dev/' + IDS.tenantA, {
      method: 'POST',
      body: raw,
      headers: {
        'x-kynetic-timestamp': String(timestamp),
        'x-kynetic-signature': signLeadBody(secret, timestamp, raw)
      }
    });
  const invoke = () =>
    handleLeadIntake(request(), IDS.tenantA, {
      db: createDb(database.app),
      workerDb,
      validate: (input) => parseDevLead(input, config)
    });
  expect((await (await invoke()).json()).data.status).toBe('accepted');
  expect((await (await invoke()).json()).data.status).toBe('duplicate');
  const [stored] =
    await database.admin`select id from webhook_events where source = 'lead_webhook' and tenant_id = ${IDS.tenantA}`;
  expect(await processWebhookEvent(stored.id, { db: workerDb })).toBe('processed');
  expect(await processWebhookEvent(stored.id, { db: workerDb })).toBe('already_processed');
  const [event] =
    await database.admin`select data from pgboss.job where name = 'event.dispatch' and data->'payload'->>'webhookEventId' = ${stored.id}`;
  envelope = event.data as EventEnvelope;
  await deliver(envelope, DEV_LEAD_SUBSCRIBER);
  await deliver(envelope, DEV_LEAD_SUBSCRIBER);
  const [queued] = await database.admin`select data from pgboss.job where name = ${DEV_LEAD_QUEUE}`;
  job = queued.data as DevLeadJob;
  job.leadAt = midday.toISOString();
});
afterAll(async () => {
  clearSubscribers();
  clearWebhookProcessors();
  await stopJobs();
  await database?.drop();
});

describe('signed synthetic intake -> durable dev queue -> native simulated booking', () => {
  it('deduplicates intake and delivery, queues IDs only and never invokes generic outbound', async () => {
    const [count] =
      await database.admin`select count(*)::int as n from pgboss.job where name = ${DEV_LEAD_QUEUE}`;
    expect(count.n).toBe(1);
    expect(Object.keys(job).sort()).toEqual(
      ['attempt', 'contactId', 'dealId', 'leadAt', 'tenantId', 'webhookEventId'].sort()
    );
    expect(envelope.payload).not.toHaveProperty('budget');
    expect(envelope.payload).not.toHaveProperty('projectType');
    await deliver(envelope, OUTBOUND_SUBSCRIBER_ID);
    expect(genericQueue).not.toHaveBeenCalled();
  });

  it('durably defers the disabled outbound attempt with no sender and preserves its attempt', async () => {
    // An active queue job can schedule one waiting successor with its stable singleton key.
    await database.admin`update pgboss.job set state = 'active' where name = ${DEV_LEAD_QUEUE}`;
    expect(await runDevLeadJob(job, { db: workerDb, config, now: midday })).toMatchObject({
      status: 'deferred',
      reason: 'outbound_disabled',
      job: { attempt: 1 }
    });
    const [retry] =
      await database.admin`select data, start_after from pgboss.job where name = ${DEV_LEAD_QUEUE} and state = 'created'`;
    expect(retry.data.attempt).toBe(1);
    expect(new Date(retry.start_after).getTime()).toBe(midday.getTime() + 60_000);
  });

  it('stops expired jobs and rejects a forged cross-tenant linkage', async () => {
    expect(
      await runDevLeadJob(job, {
        db: workerDb,
        config,
        now: new Date(midday.getTime() + 24 * 3_600_000)
      })
    ).toEqual({ status: 'expired' });
    await expect(
      runDevLeadJob({ ...job, tenantId: IDS.tenantB }, { db: workerDb, config, now: midday })
    ).rejects.toThrow('Stored DEV lead not found');
    await expect(
      runDevLeadJob({ ...job, contactId: IDS.ownerA }, { db: workerDb, config, now: midday })
    ).rejects.toThrow('linkage mismatch');
    await expect(
      runDevLeadJob(job, {
        db: workerDb,
        config: { ...config, APP_BASE_URL: 'https://portal.kyneticai.com' },
        now: midday
      })
    ).rejects.toThrow('dev-only');
  });

  it('stores a bounded delayed retry atomically and rolls it back with the transaction', async () => {
    const ctx = { tenantId: job.tenantId, role: 'system' as const };
    const retry = {
      job: { contactId: job.contactId, externalId: `DEV-${job.webhookEventId}`, attempt: 2 },
      key: `DEV-retry-${job.webhookEventId}:2`,
      at: new Date(midday.getTime() + 90_000),
      reason: 'provider_transient'
    };
    await expect(
      withTenant(
        ctx,
        async (tx) => {
          await devRetryScheduler(job, tx)(retry);
          throw new Error('Synthetic rollback');
        },
        { db: workerDb }
      )
    ).rejects.toThrow('Synthetic rollback');
    const [before] =
      await database.admin`select count(*)::int as n from pgboss.job where name = ${DEV_LEAD_QUEUE} and data->>'attempt' = '2'`;
    expect(before.n).toBe(0);
    await withTenant(ctx, (tx) => devRetryScheduler(job, tx)(retry), { db: workerDb });
    const [after] =
      await database.admin`select data, start_after from pgboss.job where name = ${DEV_LEAD_QUEUE} and data->>'attempt' = '2'`;
    expect(after.data.attempt).toBe(2);
    expect(new Date(after.start_after).getTime()).toBe(retry.at.getTime());
  });

  it.each([
    ['before opening', '2026-11-05T16:30:00Z', '2026-11-05T17:00:00Z'],
    ['crossing closing', '2026-11-06T00:45:00Z', '2026-11-06T01:15:00Z']
  ])('rejects a slot %s without storing an appointment', async (_label, startsAt, endsAt) => {
    await expect(
      bookDevSyntheticAppointment(
        job,
        { startsAt: new Date(startsAt), endsAt: new Date(endsAt), simulation: true },
        { db: workerDb, config, providerMode: 'stub' }
      )
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { startsAt: ['outside_business_hours'] }
    });
    const [count] =
      await database.admin`select count(*)::int as n from appointments where external_event_id = ${'DEV-SIMULATION-' + job.webhookEventId}`;
    expect(count.n).toBe(0);
  });

  it('books one native DEV simulation and deduplicates a replay without calling a calendar', async () => {
    const slot = {
      startsAt: midday,
      endsAt: new Date(midday.getTime() + 30 * 60_000),
      simulation: true as const
    };
    const opts = { db: workerDb, config, providerMode: 'stub' as const };
    const [first, concurrent] = await Promise.all([
      bookDevSyntheticAppointment(job, slot, opts),
      bookDevSyntheticAppointment(job, slot, opts)
    ]);
    expect(concurrent.id).toBe(first.id);
    const replay = await bookDevSyntheticAppointment(job, slot, opts);
    expect(replay.id).toBe(first.id);
    expect(first.contactId).toBe(job.contactId);
    expect(first.dealId).toBe(job.dealId);
    expect(first.notes).toContain('no real calendar reservation');
    await expect(
      bookDevSyntheticAppointment(job, slot, { ...opts, providerMode: 'live' })
    ).rejects.toThrow('stub mode');
    await expect(
      bookDevSyntheticAppointment(job, slot, {
        ...opts,
        config: { ...config, OUTBOUND_ENABLED: true }
      })
    ).rejects.toThrow('outbound disabled');
    const [count] =
      await database.admin`select count(*)::int as n from appointments where external_event_id = ${'DEV-SIMULATION-' + job.webhookEventId}`;
    expect(count.n).toBe(1);
  });
});
