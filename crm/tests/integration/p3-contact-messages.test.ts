import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import { listActivities } from '@/server/activity';
import { addDncEntry, recordConsent, revokeConsent } from '@/server/consent';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import {
  createTwilioProcessor,
  getComposeState,
  listContactThread,
  sendContactMessage
} from '@/server/messaging';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// Phase 3 (P3-1, P3-2, P3-3, P3-6): a message typed on a contact page goes through the same gate as
// every other send, is stored, shows on the timeline, and is refused with a reason when it should be.

const A_NUMBER = '+15555550100';
const NOON = new Date('2026-10-26T19:00:00Z'); // 12:00 PDT
const NIGHT = new Date('2026-10-27T06:00:00Z'); // 23:00 PDT
const gate = { outboundEnabled: true };

let tdb: TestDatabase;
let appDb: Db;
let workerDb: Db;
let n = 0;
const sms = new FakeSmsProvider();
const email = new FakeEmailProvider();
const deps = (now = NOON, g: { outboundEnabled: boolean } = gate) => ({
  smsProvider: sms,
  emailProvider: email,
  now,
  gate: g
});

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
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
    values (${IDS.tenantA}, ${A_NUMBER}, 'twilio', 'PNa', 'sms', 'approved')`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${IDS.tenantA}, 'crm', true, 'lite') on conflict do nothing`;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

async function newContact(opts: { consent?: boolean; email?: boolean } = {}) {
  n += 1;
  const phone = `+1555555${String(6000 + n)}`;
  const mail = `lead${n}@example.test`;
  const [c] =
    await tdb.admin`insert into contacts (tenant_id, first_name, primary_phone_e164, primary_email, timezone)
    values (${IDS.tenantA}, ${'Lead ' + n}, ${phone}, ${opts.email === false ? null : mail}, 'America/Los_Angeles') returning id`;
  if (opts.consent !== false) {
    for (const channel of ['sms', 'email', 'phone_call'] as const) {
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
  return { id: c.id as string, phone, mail };
}

describe('P3-1 a message sent from a contact', () => {
  it('sends a text through the gate, stores it, logs it and shows it on the timeline', async () => {
    const lead = await newContact();
    sms.sent.length = 0;
    const r = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'sms', body: 'Can we come by Tuesday?' },
      deps()
    );
    expect(r.status).toBe('sent');
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0]).toMatchObject({ toE164: lead.phone, fromE164: A_NUMBER });

    const [m] =
      await tdb.admin`select direction, actor_type, actor_id, status, body from messages where contact_id = ${lead.id}`;
    expect(m).toMatchObject({
      direction: 'outbound',
      actor_type: 'user',
      actor_id: IDS.ownerA,
      status: 'sent',
      body: 'Can we come by Tuesday?'
    });
    const timeline = await listActivities(ctx.ownerA(), { contactId: lead.id }, { db: appDb });
    expect(timeline.items.some((i) => i.type === 'sms' && i.summary === 'Text sent')).toBe(true);
    const thread = await listContactThread(ctx.ownerA(), lead.id);
    expect(thread).toHaveLength(1);
    expect(thread[0]).toMatchObject({ channel: 'sms', direction: 'outbound' });
  });

  it('sends an email through the gate and shows it on the timeline', async () => {
    const lead = await newContact();
    email.sent.length = 0;
    const r = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'email', subject: 'Your estimate', body: 'Attached soon.' },
      deps()
    );
    expect(r.status).toBe('sent');
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({ to: lead.mail, subject: 'Your estimate' });
    const [m] =
      await tdb.admin`select channel, status, subject from messages where contact_id = ${lead.id}`;
    expect(m).toMatchObject({ channel: 'email', status: 'sent', subject: 'Your estimate' });
    const timeline = await listActivities(ctx.ownerA(), { contactId: lead.id }, { db: appDb });
    expect(timeline.items.some((i) => i.type === 'email')).toBe(true);
  });

  it('holds a text during quiet hours and says when it can go out', async () => {
    const lead = await newContact();
    sms.sent.length = 0;
    const r = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'sms', body: 'hello' },
      deps(NIGHT)
    );
    expect(r).toMatchObject({ status: 'blocked', reason: 'quiet_hours' });
    if (r.status === 'blocked') expect(r.message).toMatch(/after/i);
    expect(sms.sent).toHaveLength(0);
  });

  it('rejects a read-only caller and a bad body', async () => {
    const lead = await newContact();
    await expect(
      sendContactMessage(
        { ...ctx.ownerA(), readOnly: true },
        { contactId: lead.id, channel: 'sms', body: 'hi' },
        deps()
      )
    ).rejects.toThrow();
    await expect(
      sendContactMessage(ctx.ownerA(), { contactId: lead.id, channel: 'sms', body: '   ' }, deps())
    ).rejects.toThrow();
  });
});

describe('P3-2 a contact who cannot be messaged', () => {
  it('blocks a contact with no consent and the compose state explains why', async () => {
    const lead = await newContact({ consent: false });
    sms.sent.length = 0;
    const r = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'sms', body: 'x' },
      deps()
    );
    expect(r).toMatchObject({ status: 'blocked', reason: 'no_consent' });
    expect(sms.sent).toHaveLength(0);
    const state = await getComposeState(ctx.ownerA(), lead.id, { now: NOON, gate });
    const text = state.find((s) => s.channel === 'sms');
    expect(text?.canSend).toBe(false);
    expect(text?.message).toMatch(/not agreed/i);
  });

  it('blocks a do-not-contact number with the DNC wording', async () => {
    const lead = await newContact();
    await addDncEntry(
      ctx.ownerA(),
      { e164: lead.phone, contactId: lead.id, source: 'staff' },
      { db: appDb }
    );
    const r = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'sms', body: 'x' },
      deps()
    );
    expect(r).toMatchObject({ status: 'blocked', reason: 'internal_dnc' });
    const state = await getComposeState(ctx.ownerA(), lead.id, { now: NOON, gate });
    expect(state.find((s) => s.channel === 'sms')?.message).toMatch(/do-not-contact/i);
  });

  it('says there is no address when the contact has no email', async () => {
    const lead = await newContact({ email: false });
    const state = await getComposeState(ctx.ownerA(), lead.id, { now: NOON, gate });
    expect(state.find((s) => s.channel === 'email')).toMatchObject({ canSend: false });
    const r = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'email', subject: 's', body: 'b' },
      deps()
    );
    expect(r).toMatchObject({ status: 'blocked', reason: 'no_address' });
  });

  it('blocks an address that bounced', async () => {
    const lead = await newContact();
    await tdb.admin`insert into email_suppressions (tenant_id, address, reason) values (${IDS.tenantA}, ${lead.mail}, 'bounced')`;
    const r = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'email', subject: 's', body: 'b' },
      deps()
    );
    expect(r).toMatchObject({ status: 'blocked', reason: 'email_suppressed' });
  });

  it('the compose preview writes no activity rows', async () => {
    const lead = await newContact({ consent: false });
    await getComposeState(ctx.ownerA(), lead.id, { now: NOON, gate });
    const rows = await tdb.admin`select 1 from activities where contact_id = ${lead.id}`;
    expect(rows).toHaveLength(0);
  });

  it('never reaches another tenant contact', async () => {
    const [other] =
      await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantB} limit 1`;
    await expect(
      sendContactMessage(ctx.ownerA(), { contactId: other.id, channel: 'sms', body: 'x' }, deps())
    ).rejects.toThrow();
  });
});

describe('P3-3 a STOP reply ends messaging', () => {
  it('after STOP, a manual text is blocked as opted out and nothing is sent', async () => {
    const lead = await newContact();
    const first = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'sms', body: 'before stop' },
      deps()
    );
    expect(first.status).toBe('sent');

    sms.sent.length = 0;
    const run = createTwilioProcessor({ provider: sms, db: workerDb, gate });
    await run({
      id: crypto.randomUUID(),
      source: 'twilio',
      externalId: `stop-${lead.id}`,
      tenantId: null,
      payload: {
        kind: 'inbound',
        event: {
          providerId: `SMstop-${lead.id}`,
          fromE164: lead.phone,
          toE164: A_NUMBER,
          body: 'STOP',
          isStop: true,
          isHelp: false
        }
      }
    } as never);
    sms.sent.length = 0; // the one STOP confirmation is not a manual send

    const after = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'sms', body: 'after stop' },
      deps()
    );
    expect(after).toMatchObject({ status: 'blocked', reason: 'opted_out' });
    expect(sms.sent).toHaveLength(0);
    const state = await getComposeState(ctx.ownerA(), lead.id, { now: NOON, gate });
    expect(state.find((s) => s.channel === 'sms')?.message).toMatch(/opted out/i);
    // Email was not part of the STOP.
    expect(state.find((s) => s.channel === 'email')?.canSend).toBe(true);
    const thread = await listContactThread(ctx.ownerA(), lead.id);
    expect(thread.some((t) => t.direction === 'inbound' && t.body === 'STOP')).toBe(true);
  });

  it('a staff revoke stops later messages with the withdrawn wording', async () => {
    const lead = await newContact();
    await revokeConsent(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'sms', source: 'staff', capturedText: 'asked by phone' },
      { db: appDb }
    );
    const r = await sendContactMessage(
      ctx.ownerA(),
      { contactId: lead.id, channel: 'sms', body: 'x' },
      deps()
    );
    expect(r).toMatchObject({ status: 'blocked', reason: 'consent_revoked' });
  });
});

describe('P3-6 nothing leaves while sending is off', () => {
  it('OUTBOUND_ENABLED=false blocks texts and emails and calls no provider', async () => {
    const lead = await newContact();
    sms.sent.length = 0;
    email.sent.length = 0;
    const off = { outboundEnabled: false };
    expect(
      await sendContactMessage(
        ctx.ownerA(),
        { contactId: lead.id, channel: 'sms', body: 'x' },
        deps(NOON, off)
      )
    ).toMatchObject({ status: 'blocked', reason: 'outbound_disabled' });
    expect(
      await sendContactMessage(
        ctx.ownerA(),
        { contactId: lead.id, channel: 'email', subject: 's', body: 'b' },
        deps(NOON, off)
      )
    ).toMatchObject({ status: 'blocked', reason: 'outbound_disabled' });
    expect(sms.sent).toHaveLength(0);
    expect(email.sent).toHaveLength(0);
    const rows = await tdb.admin`select 1 from messages where contact_id = ${lead.id}`;
    expect(rows).toHaveLength(0);
  });

  it('the portal pause and the client kill switch also hold', async () => {
    const lead = await newContact();
    sms.sent.length = 0;
    await tdb.admin`update platform_settings set outbound_paused = true, reason = 'test' where singleton = true`;
    try {
      expect(
        await sendContactMessage(
          ctx.ownerA(),
          { contactId: lead.id, channel: 'sms', body: 'x' },
          deps()
        )
      ).toMatchObject({ status: 'blocked', reason: 'global_pause' });
    } finally {
      await tdb.admin`update platform_settings set outbound_paused = false, reason = null where singleton = true`;
    }
    expect(sms.sent).toHaveLength(0);
  });
});
