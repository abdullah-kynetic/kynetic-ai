import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { POST as bookRoute } from '@/app/api/appointments/book/route';
import { POST as callResultRoute } from '@/app/api/service/call-results/route';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import { FakeVoiceProvider } from '@/server/adapters/voice/fake';
import { listAdminTenantOverview } from '@/server/admin';
import { listAppointments } from '@/server/appointments';
import {
  OUTBOUND_CALL_QUEUE,
  registerOutboundCallSubscriber,
  runOutboundCall,
  type OutboundCallJob
} from '@/server/calls';
import { OUTBOUND_SUBSCRIBER_ID } from '@/server/calls/outbound';
import { listCalls } from '@/server/calls/list';
import { createDb, type Db } from '@/server/db/client';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { stopJobs, type enqueue } from '@/server/jobs';
import {
  handleLeadIntake,
  issueLeadWebhookSecret,
  registerLeadProcessor,
  signLeadBody
} from '@/server/leads';
import { sendSms } from '@/server/messaging';
import { getDashboardMetrics, rollupMetricsDaily } from '@/server/metrics';
import { issueServiceToken } from '@/server/service-auth';
import { clearWebhookProcessors, processWebhookEvent } from '@/server/webhooks';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// P6-1 and P6-3. One demo client, stub mode, no network: a signed lead arrives, Alex's call starts
// (fake provider), the call result and the booking come in over the service API the n8n workflow
// will use, a follow-up text is gated and sent through the fake SMS provider, and the client
// dashboard and the admin views show it. Replaces the dev-only chain test (P6-S4).

let tdb: TestDatabase;
let workerDb: Db;
let appDb: Db;
const LEAD_PHONE = '+15555550177';
// Thursday 10:00 PST, inside the 09:00-17:00 hours configured below.
const MIDDAY = new Date('2026-11-05T18:00:00Z');
const SLOT_START = new Date('2026-11-05T22:00:00Z');
const SLOT_END = new Date('2026-11-05T23:00:00Z');
const queued: { name: string; payload: unknown }[] = [];
const fakeQueue = (async (name: string, payload: object) => {
  queued.push({ name, payload });
  return 'job';
}) as unknown as typeof enqueue;
const voice = new FakeVoiceProvider();
const sms = new FakeSmsProvider();
const gate = { outboundEnabled: true };
let tokens: { calls: string; appointments: string };
const actorA = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: {
    tenantId: IDS.tenantA,
    role: 'owner' as const,
    canExport: true,
    canBulkDelete: true
  },
  viewAs: null
};
let contactId = '';
let dealId = '';
let callId = '';
let providerCallId = '';
let appointmentId = '';
const fetchSpy = vi.fn(async () => {
  throw new Error('Real network forbidden');
});

const post = (
  route: (r: Request) => Promise<Response>,
  path: string,
  token: string,
  body: unknown
) =>
  route(
    new Request(`http://localhost${path}`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify(body)
    })
  );

beforeAll(async () => {
  vi.stubGlobal('fetch', fetchSpy);
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  workerDb = createDb(tdb.worker);
  appDb = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = appDb;
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32),
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false'
  });
  clearSubscribers();
  clearWebhookProcessors();
  registerLeadProcessor();
  registerOutboundCallSubscriber({ queue: fakeQueue });
  await tdb.admin`update tenants set business_hours = ${tdb.admin.json({ thu: [{ open: '09:00', close: '17:00' }] })},
    recording_disclosure = 'This call is recorded.' where id = ${IDS.tenantA}`;
  await tdb.admin`update alex_configs set provider = 'elevenlabs', agent_ref = 'agent_demo', paused = false,
    call_windows = '{}'::jsonb, retry = '{}'::jsonb where tenant_id = ${IDS.tenantA}`;
  await tdb.admin`insert into phone_numbers (tenant_id, e164, provider, provider_sid, purpose, a2p_status)
    values (${IDS.tenantA}, '+15555550100', 'twilio', 'PNdemo', 'sms', 'approved')`;
  tokens = {
    calls: (
      await issueServiceToken(
        ctx.ownerA(),
        { label: 'demo n8n', scopes: ['calls:write'] },
        { db: appDb }
      )
    ).token,
    appointments: (
      await issueServiceToken(
        ctx.ownerA(),
        { label: 'demo n8n booking', scopes: ['appointments:write'] },
        { db: appDb }
      )
    ).token
  };
});
afterAll(async () => {
  vi.unstubAllGlobals();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  clearSubscribers();
  clearWebhookProcessors();
  await stopJobs();
  await tdb?.drop();
});

describe('demo client, stub mode, lead to booking to follow-up', () => {
  it('accepts a signed lead, creates the contact and deal, and deduplicates a retry', async () => {
    const secret = await issueLeadWebhookSecret(IDS.tenantA, { db: workerDb });
    const raw = JSON.stringify({
      externalId: 'demo-lead-1',
      source: 'form',
      firstName: 'Demo',
      lastName: 'Homeowner',
      phone: LEAD_PHONE,
      serviceType: 'Kitchen remodel',
      consent: {
        capturedText: 'Demo consent wording.',
        channels: ['phone_call', 'sms']
      }
    });
    const ts = Math.floor(Date.now() / 1000);
    const send = () =>
      handleLeadIntake(
        new Request(`http://localhost/api/hooks/leads/${IDS.tenantA}`, {
          method: 'POST',
          body: raw,
          headers: {
            'x-kynetic-timestamp': String(ts),
            'x-kynetic-signature': signLeadBody(secret, ts, raw)
          }
        }),
        IDS.tenantA,
        { db: appDb, workerDb }
      );
    expect((await (await send()).json()).data.status).toBe('accepted');
    expect((await (await send()).json()).data.status).toBe('duplicate');
    const [stored] =
      await tdb.admin`select id from webhook_events where source = 'lead_webhook' and tenant_id = ${IDS.tenantA}`;
    expect(await processWebhookEvent(stored.id, { db: workerDb })).toBe('processed');
    const [contact] =
      await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantA} and primary_phone_e164 = ${LEAD_PHONE}`;
    const [deal] =
      await tdb.admin`select d.id from deals d join deal_contacts dc on dc.deal_id = d.id where dc.contact_id = ${contact.id}`;
    contactId = contact.id;
    dealId = deal.id;
    const [event] =
      await tdb.admin`select data from pgboss.job where name = 'event.dispatch' and data->>'name' = 'lead.created' and data->'payload'->>'contactId' = ${contactId}`;
    expect(await deliver(event.data as EventEnvelope, OUTBOUND_SUBSCRIBER_ID)).toBe('ran');
    const job = queued.find((q) => q.name === OUTBOUND_CALL_QUEUE);
    expect(job?.payload).toMatchObject({
      tenantId: IDS.tenantA,
      contactId,
      attempt: 1
    });
  });

  it('starts Alex’s call through the fake provider and calls no real network', async () => {
    const job = queued.find((q) => q.name === OUTBOUND_CALL_QUEUE)!.payload as OutboundCallJob;
    const res = await runOutboundCall(
      { ...job, leadAt: MIDDAY.toISOString() },
      {
        db: workerDb,
        now: () => MIDDAY,
        provider: () => voice,
        queue: fakeQueue,
        gate
      }
    );
    expect(res.status).toBe('started');
    expect(voice.calls).toHaveLength(1);
    expect(voice.calls[0]).toMatchObject({
      toE164: LEAD_PHONE,
      agentId: 'agent_demo'
    });
    const [row] =
      await tdb.admin`select id, provider_call_id from calls where contact_id = ${contactId}`;
    callId = row.id;
    providerCallId = row.provider_call_id;
    expect(providerCallId).toBe('fake_call_1');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('records the call result and the booking over the service API', async () => {
    const result = await post(callResultRoute, '/api/service/call-results', tokens.calls, {
      eventId: crypto.randomUUID(),
      version: 1,
      occurredAt: MIDDAY.toISOString(),
      payload: {
        contactId,
        provider: 'elevenlabs',
        providerCallId,
        agentId: 'agent_demo',
        direction: 'outbound',
        startedAt: MIDDAY.toISOString(),
        durationS: 95,
        outcome: 'booked',
        sentiment: 'positive',
        summary: 'Demo: homeowner booked an estimate.'
      }
    });
    expect(result.status).toBe(201);
    expect((await result.json()).data.callId).toBe(callId);

    const book = await post(bookRoute, '/api/appointments/book', tokens.appointments, {
      contactId,
      dealId,
      startsAt: SLOT_START.toISOString(),
      endsAt: SLOT_END.toISOString(),
      externalEventId: 'calcom-demo-1'
    });
    expect(book.status).toBe(201);
    const body = await book.json();
    appointmentId = body.appointment.id;
    // A repeat of the same booking returns the same appointment instead of a second one.
    const again = await post(bookRoute, '/api/appointments/book', tokens.appointments, {
      contactId,
      dealId,
      startsAt: SLOT_START.toISOString(),
      endsAt: SLOT_END.toISOString(),
      externalEventId: 'calcom-demo-1'
    });
    expect((await again.json()).appointment.id).toBe(appointmentId);
  });

  it('sends the follow-up text through the gate and the fake provider', async () => {
    const res = await sendSms(
      { tenantId: IDS.tenantA, role: 'system' },
      {
        contactId,
        module: 'alex_core',
        body: 'Demo: your estimate is booked for Thursday at 2 PM.',
        idempotencyKey: `demo-confirm:${appointmentId}`,
        purpose: 'booking_confirmation'
      },
      { provider: sms, now: MIDDAY, gate }
    );
    expect(res.status).toBe('sent');
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]).toMatchObject({
      toE164: LEAD_PHONE,
      fromE164: '+15555550100'
    });
  });

  it('shows the booking as an appointment, a call and dashboard numbers for the client', async () => {
    const appts = await listAppointments(
      ctx.ownerA(),
      new Date('2026-11-01T00:00:00Z'),
      new Date('2026-12-01T00:00:00Z'),
      { db: appDb }
    );
    expect(
      appts.some((a) => a.appointment.id === appointmentId && a.appointment.contactId === contactId)
    ).toBe(true);
    const calls = await listCalls(actorA, ctx.ownerA(), {}, { db: appDb });
    const row = calls.rows.find((c) => c.id === callId);
    expect(row).toMatchObject({ outcome: 'booked' });

    const today = new Date().toISOString().slice(0, 10);
    for (const day of ['2026-11-05', today])
      await rollupMetricsDaily({ tenantId: IDS.tenantA, day }, { db: workerDb });
    const metrics = await getDashboardMetrics(ctx.ownerA(), '2026-11-05', today, { db: appDb });
    expect(metrics.totals.leads).toBeGreaterThanOrEqual(1);
    expect(metrics.totals.calls).toBeGreaterThanOrEqual(1);
    expect(metrics.totals.estimatesBooked).toBeGreaterThanOrEqual(1);
  });

  it('shows the same client to a Kynetic admin', async () => {
    const rows = await listAdminTenantOverview({ userId: IDS.admin, role: 'admin' }, { db: appDb });
    const demo = rows.find((r) => r.tenantId === IDS.tenantA);
    expect(demo).toBeDefined();
    expect(demo!.calls30d).toBeGreaterThanOrEqual(0);
    const [{ n }] =
      await tdb.admin`select count(*)::int as n from appointments where tenant_id = ${IDS.tenantA} and id = ${appointmentId}`;
    expect(n).toBe(1);
  });
});
