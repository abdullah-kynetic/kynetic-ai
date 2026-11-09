import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, sql } from 'drizzle-orm';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import { TwilioSmsProvider, twilioSignature } from '@/server/adapters/sms/twilio';
import { canContact, recordConsent } from '@/server/consent';
import { createDb, type Db } from '@/server/db/client';
import { activities, consents, dncEntries, messages, webhookEvents } from '@/server/db/schema';
import { stopJobs } from '@/server/jobs';
import {
  createTwilioProcessor,
  handleTwilioInbound,
  handleTwilioStatus,
  sendSms
} from '@/server/messaging';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const A_NUMBER = '+15555550100';
const B_NUMBER = '+15555550200';
const LEAD = '+15555550102';
const NOON = new Date('2026-10-26T19:00:00Z'); // 12:00 PDT
const system = { tenantId: IDS.tenantA, role: 'system' as const };

let tdb: TestDatabase;
let appDb: Db;
let workerDb: Db;
let a: SeededTenant;
let n = 0;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(tdb.admin));
  appDb = createDb(tdb.app);
  workerDb = createDb(tdb.worker);
  Object.assign(process.env, {
    APP_BASE_URL: 'https://portal.example.test',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32)
  });
  await tdb.admin`insert into phone_numbers (tenant_id, e164, provider, provider_sid, purpose, a2p_status)
    values (${IDS.tenantA}, ${A_NUMBER}, 'twilio', 'PNa', 'sms', 'approved'),
           (${IDS.tenantB}, ${B_NUMBER}, 'twilio', 'PNb', 'sms', 'approved')`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'alex_core', true) on conflict do nothing`;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

async function newLead(consent = true) {
  n += 1;
  const phone = `+1555555${String(4000 + n)}`;
  const [c] =
    await tdb.admin`insert into contacts (tenant_id, first_name, primary_phone_e164, timezone)
    values (${IDS.tenantA}, ${'Lead ' + n}, ${phone}, 'America/Los_Angeles') returning id`;
  if (consent) {
    for (const channel of ['sms', 'phone_call'] as const) {
      await recordConsent(
        ctx.ownerA(),
        {
          contactId: c.id,
          channel,
          source: 'form',
          capturedText: 'ok',
          capturedAt: new Date('2026-10-01')
        },
        { db: appDb }
      );
    }
  }
  return { id: c.id as string, phone };
}

const gate = { outboundEnabled: true };

// One provider for the file keeps fake message ids unique; each test starts with an empty outbox.
const fakeProvider = new FakeSmsProvider();
function setup() {
  const provider = fakeProvider;
  provider.sent.length = 0;
  const run = createTwilioProcessor({ provider, db: workerDb, gate });
  return { provider, run };
}

const event = (payload: unknown, externalId = `e${++n}`) => ({
  id: crypto.randomUUID(),
  source: 'twilio',
  externalId,
  tenantId: null,
  payload
});

describe('M4-08 phone_number_tenant_lookup', () => {
  it('maps an owned number to its tenant for the app and worker roles only', async () => {
    const q = (s: typeof tdb.app) => s`select * from phone_number_tenant_lookup(${A_NUMBER})`;
    expect((await q(tdb.app))[0].tenant_id).toBe(IDS.tenantA);
    expect((await q(tdb.worker))[0].tenant_id).toBe(IDS.tenantA);
    expect(await tdb.app`select * from phone_number_tenant_lookup('+15555550999')`).toHaveLength(0);
    await tdb.admin`update phone_numbers set released_at = now() where e164 = ${B_NUMBER}`;
    expect(await tdb.app`select * from phone_number_tenant_lookup(${B_NUMBER})`).toHaveLength(0);
    await tdb.admin`update phone_numbers set released_at = null where e164 = ${B_NUMBER}`;
  });
});

describe('M4-08 sendSms gating (F-74)', () => {
  it('blocks with sms_not_approved while no number is approved, and calls no provider', async () => {
    const lead = await newLead();
    await tdb.admin`update phone_numbers set a2p_status = 'pending' where e164 = ${A_NUMBER}`;
    const { provider } = setup();
    const r = await sendSms(
      system,
      { contactId: lead.id, module: 'alex_core', body: 'hi', idempotencyKey: 'k1' },
      { provider, now: NOON, gate }
    );
    expect(r).toMatchObject({ status: 'blocked', reason: 'sms_not_approved' });
    expect(provider.sent).toHaveLength(0);
    const [blocked] = await tdb.admin`select summary from activities where contact_id = ${lead.id}`;
    expect(blocked.summary).toContain('sms_not_approved');
    await tdb.admin`update phone_numbers set a2p_status = 'approved' where e164 = ${A_NUMBER}`;
  });

  it('quiet hours and global/tenant kill switches block the actual sendSms dispatcher', async () => {
    const lead = await newLead();
    const { provider } = setup();
    const req = {
      contactId: lead.id,
      module: 'alex_core' as const,
      body: 'DEV synthetic safety check',
      idempotencyKey: 'dev-step4-blocks'
    };
    expect(
      await sendSms(system, req, { provider, now: new Date('2026-10-27T05:00:00Z'), gate })
    ).toMatchObject({ status: 'blocked', reason: 'quiet_hours' });
    expect(
      await sendSms(system, req, { provider, now: NOON, gate: { outboundEnabled: false } })
    ).toMatchObject({ status: 'blocked', reason: 'outbound_disabled' });
    const [before] =
      await tdb.admin`select config from tenant_modules where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    try {
      await tdb.admin`update tenant_modules set config = config || '{"outbound_kill_switch":true}'::jsonb where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
      expect(await sendSms(system, req, { provider, now: NOON, gate })).toMatchObject({
        status: 'blocked',
        reason: 'outbound_disabled'
      });
    } finally {
      await tdb.admin`update tenant_modules set config = ${tdb.admin.json(before.config)} where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    }
    expect(provider.sent).toHaveLength(0);
    const [messages] =
      await tdb.admin`select count(*)::int as n from messages where contact_id = ${lead.id}`;
    expect(messages.n).toBe(0);
  });

  it('sends once approved, stores the message and activity', async () => {
    const lead = await newLead();
    const { provider } = setup();
    const r = await sendSms(
      system,
      { contactId: lead.id, module: 'alex_core', body: 'hi', idempotencyKey: 'k2' },
      { provider, now: NOON, gate }
    );
    expect(r.status).toBe('sent');
    expect(provider.sent[0]).toMatchObject({ fromE164: A_NUMBER, toE164: lead.phone });
    const [m] =
      await tdb.admin`select status, provider_message_id from messages where contact_id = ${lead.id}`;
    expect(m.status).toBe('sent');
  });

  it('does not send without consent, and stores a registration failure without retrying', async () => {
    const noConsent = await newLead(false);
    const { provider } = setup();
    expect(
      await sendSms(
        system,
        { contactId: noConsent.id, module: 'alex_core', body: 'x', idempotencyKey: 'k3' },
        { provider, now: NOON, gate }
      )
    ).toMatchObject({ status: 'blocked', reason: 'no_consent' });

    const lead = await newLead();
    const failing = {
      id: 'twilio' as const,
      send: async () => {
        const { ProviderError } = await import('@/server/adapters/errors');
        throw new ProviderError('permanent', 'a2p_not_registered', 'Twilio error 30034');
      },
      parseStatusCallback: provider.parseStatusCallback,
      parseInbound: provider.parseInbound
    };
    const r = await sendSms(
      system,
      { contactId: lead.id, module: 'alex_core', body: 'x', idempotencyKey: 'k4' },
      { provider: failing, now: NOON, gate }
    );
    expect(r).toMatchObject({ status: 'failed', errorCode: 'a2p_not_registered' });
    const [m] =
      await tdb.admin`select status, error_code from messages where contact_id = ${lead.id}`;
    expect(m).toMatchObject({ status: 'failed', error_code: 'a2p_not_registered' });
  });
});

describe('M4-08 status callbacks (F-30)', () => {
  const shared = setup();
  async function sentMessage() {
    const lead = await newLead();
    const { provider, run } = shared;
    const r = await sendSms(
      system,
      { contactId: lead.id, module: 'alex_core', body: 'hi', idempotencyKey: `s${n}` },
      { provider, now: NOON, gate }
    );
    if (r.status !== 'sent') throw new Error('setup');
    return { lead, run, sid: r.providerId, messageId: r.messageId };
  }
  const status = (sid: string, s: string, extra: object = {}) => ({
    kind: 'status',
    event: { providerId: sid, status: s, fromE164: A_NUMBER, toE164: '+15555550102', ...extra }
  });

  it('marks delivered, never downgrades, and records failures with their code', async () => {
    const { run, sid, messageId } = await sentMessage();
    await run(event(status(sid, 'delivered')));
    await run(event(status(sid, 'sent')));
    const [m] = await tdb.admin`select status, delivered_at from messages where id = ${messageId}`;
    expect(m.status).toBe('delivered');
    expect(m.delivered_at).not.toBeNull();

    const f = await sentMessage();
    await f.run(event(status(f.sid, 'undelivered', { errorCode: '30003' })));
    const [fm] = await tdb.admin`select status, error_code from messages where id = ${f.messageId}`;
    expect(fm).toMatchObject({ status: 'failed', error_code: '30003' });
  });

  it("ignores a callback routed through another tenant's number", async () => {
    const { run, sid, messageId } = await sentMessage();
    await run(
      event({ kind: 'status', event: { providerId: sid, status: 'delivered', fromE164: B_NUMBER } })
    );
    const [m] = await tdb.admin`select status from messages where id = ${messageId}`;
    expect(m.status).toBe('sent');
  });

  it('ignores a number nobody owns', async () => {
    const { run } = setup();
    await expect(
      run(
        event({
          kind: 'status',
          event: { providerId: 'SMx', status: 'delivered', fromE164: '+15555550999' }
        })
      )
    ).resolves.toBeUndefined();
  });
});

describe('M4-08 inbound STOP and HELP (F-74, SECURITY 3.3)', () => {
  const inbound = (from: string, body: string, sid = `SM${++n}`) => ({
    kind: 'inbound',
    event: {
      providerId: sid,
      fromE164: from,
      toE164: A_NUMBER,
      body,
      isStop: ['stop', 'quit'].includes(body.trim().toLowerCase()),
      isHelp: body.trim().toLowerCase() === 'help'
    }
  });
  const sms = (contactId: string) =>
    canContact(ctx.ownerA(), contactId, 'sms', NOON, { db: appDb });

  it('STOP revokes SMS only, stores the message, confirms once, and is idempotent', async () => {
    const lead = await newLead();
    const { provider, run } = setup();
    const ev = event(inbound(lead.phone, 'STOP', 'SMstop1'));
    await run(ev);
    await run(ev); // redelivered job
    expect(await sms(lead.id)).toMatchObject({ allowed: false, reason: 'opted_out' });
    const rows = await withTenant(
      system,
      (tx) =>
        tx
          .select()
          .from(consents)
          .where(and(eq(consents.contactId, lead.id), eq(consents.kind, 'opt_out'))),
      { db: workerDb }
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].channel).toBe('sms');
    // voice consent untouched
    expect(await canContact(ctx.ownerA(), lead.id, 'phone_call', NOON, { db: appDb })).toEqual({
      allowed: true
    });
    const inboundRows =
      await tdb.admin`select 1 from messages where provider_message_id = 'SMstop1'`;
    expect(inboundRows).toHaveLength(1);
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0].body).toContain('unsubscribed');
  });

  it('STOP from a number with no contact blocks the number', async () => {
    const { run } = setup();
    await run(event(inbound('+15555550777', 'stop')));
    const rows = await withTenant(
      system,
      (tx) => tx.select().from(dncEntries).where(eq(dncEntries.e164, '+15555550777')),
      { db: workerDb }
    );
    expect(rows).toHaveLength(1);
  });

  it('HELP replies with the business name and leaves consent alone', async () => {
    const lead = await newLead();
    const { provider, run } = setup();
    await run(event(inbound(lead.phone, 'HELP')));
    expect(provider.sent[0].body).toContain('Tenant A');
    expect(await sms(lead.id)).toEqual({ allowed: true });
  });

  it('flags a free-text opt-out for review without revoking', async () => {
    const lead = await newLead();
    const { provider, run } = setup();
    await run(event(inbound(lead.phone, 'please do not contact me again')));
    expect(provider.sent).toHaveLength(0);
    expect(await sms(lead.id)).toEqual({ allowed: true });
    const flagged = await withTenant(
      system,
      (tx) =>
        tx
          .select()
          .from(activities)
          .where(and(eq(activities.contactId, lead.id), sql`meta->>'flaggedForReview' = 'true'`)),
      { db: workerDb }
    );
    expect(flagged).toHaveLength(1);
  });
});

describe('M4-08 webhook routes (F-77)', () => {
  const token = 'route-test-token-000000000000000000';
  const real = new TwilioSmsProvider({
    accountSid: 'ACtest',
    authToken: token,
    publicBaseUrl: 'https://portal.example.test'
  });
  function post(path: string, params: Record<string, string>, sign = true) {
    const body = new URLSearchParams(params);
    const sig = twilioSignature(token, `https://portal.example.test${path}`, body);
    return new Request(`https://portal.example.test${path}`, {
      method: 'POST',
      headers: sign ? { 'x-twilio-signature': sig } : {},
      body
    });
  }
  const count = async () =>
    (await tdb.admin`select count(*)::int as n from webhook_events where source = 'twilio'`)[0]
      .n as number;

  it('rejects a bad signature with 401 and stores nothing', async () => {
    const before = await count();
    const res = await handleTwilioInbound(
      post(
        '/api/hooks/twilio/inbound',
        { MessageSid: 'SMr1', From: LEAD, To: A_NUMBER, Body: 'hi' },
        false
      ),
      { provider: real }
    );
    expect(res.status).toBe(401);
    expect(await count()).toBe(before);
  });

  it('accepts a valid inbound once and answers 200 to a replay', async () => {
    const before = await count();
    const params = { MessageSid: 'SMr2', From: LEAD, To: A_NUMBER, Body: 'hi' };
    const first = await handleTwilioInbound(post('/api/hooks/twilio/inbound', params), {
      provider: real
    });
    const replay = await handleTwilioInbound(post('/api/hooks/twilio/inbound', params), {
      provider: real
    });
    expect([first.status, replay.status]).toEqual([200, 200]);
    expect(await count()).toBe(before + 1);
  });

  it('stores a signed status callback under message id and status', async () => {
    const res = await handleTwilioStatus(
      post('/api/hooks/twilio/status', {
        MessageSid: 'SMr3',
        MessageStatus: 'delivered',
        From: A_NUMBER,
        To: LEAD
      }),
      { provider: real }
    );
    expect(res.status).toBe(200);
    const rows = await withTenant(
      system,
      (tx) => tx.select().from(webhookEvents).where(eq(webhookEvents.externalId, 'SMr3:delivered')),
      { db: workerDb }
    );
    expect(rows).toHaveLength(1);
  });
});

void messages;
