import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import { addDncEntry, recordConsent, revokeConsent } from '@/server/consent';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { sendSms } from '@/server/messaging';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// P6-4. The follow-up text after a booking goes through the one SMS dispatcher. Missing consent,
// withdrawn consent, an opt-out, the do-not-call list, quiet hours and the kill switches each block it,
// and a block calls no provider and writes no message row.

let tdb: TestDatabase;
let workerDb: Db;
const system = { tenantId: IDS.tenantA, role: 'system' as const };
const NOON = new Date('2026-11-05T20:00:00Z'); // 12:00 PST
const NIGHT = new Date('2026-11-06T07:00:00Z'); // 23:00 PST
const gate = { outboundEnabled: true };
const sms = new FakeSmsProvider();
let n = 0;

async function lead(consent: boolean) {
  n += 1;
  const phone = `+1555555${String(5000 + n)}`;
  const [c] =
    await tdb.admin`insert into contacts (tenant_id, first_name, primary_phone_e164, timezone)
    values (${IDS.tenantA}, ${'Follow ' + n}, ${phone}, 'America/Los_Angeles') returning id`;
  if (consent)
    await recordConsent(
      ctx.ownerA(),
      {
        contactId: c.id,
        channel: 'sms',
        source: 'form',
        capturedText: 'ok to text',
        capturedAt: new Date('2026-10-01')
      },
      { db: workerDb }
    );
  return { id: c.id as string, phone };
}
const followUp = (contactId: string, over: Record<string, unknown> = {}) =>
  sendSms(
    system,
    {
      contactId,
      module: 'alex_core',
      body: 'Your estimate is booked.',
      idempotencyKey: `followup:${contactId}`,
      purpose: 'booking_confirmation'
    },
    { provider: sms, now: NOON, gate, ...over }
  );
const messageCount = async (contactId: string) =>
  (await tdb.admin`select count(*)::int as n from messages where contact_id = ${contactId}`)[0].n;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  workerDb = createDb(tdb.worker);
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
  await tdb.admin`insert into phone_numbers (tenant_id, e164, provider, provider_sid, purpose, a2p_status)
    values (${IDS.tenantA}, '+15555550100', 'twilio', 'PNfu', 'sms', 'approved')`;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('follow-up text gating', () => {
  it('sends when consent is on file, inside the window, with outbound enabled', async () => {
    const c = await lead(true);
    expect(await followUp(c.id)).toMatchObject({ status: 'sent' });
    expect(sms.sent.at(-1)).toMatchObject({ toE164: c.phone });
  });

  it('blocks with no consent', async () => {
    const before = sms.sent.length;
    const c = await lead(false);
    expect(await followUp(c.id)).toMatchObject({ status: 'blocked', reason: 'no_consent' });
    expect(sms.sent).toHaveLength(before);
    expect(await messageCount(c.id)).toBe(0);
  });

  it('blocks after consent is withdrawn or the person opts out', async () => {
    const before = sms.sent.length;
    const c = await lead(true);
    await revokeConsent(
      ctx.ownerA(),
      { contactId: c.id, channel: 'sms', source: 'inbound_stop', capturedText: 'STOP' },
      { db: workerDb }
    );
    const r = await followUp(c.id);
    expect(r.status).toBe('blocked');
    expect(['consent_revoked', 'opted_out']).toContain((r as { reason: string }).reason);
    expect(sms.sent).toHaveLength(before);
    expect(await messageCount(c.id)).toBe(0);
  });

  it('blocks a number on the do-not-call list even with consent on file', async () => {
    const before = sms.sent.length;
    const c = await lead(true);
    await addDncEntry(
      ctx.ownerA(),
      { e164: c.phone, contactId: c.id, source: 'staff' },
      { db: workerDb }
    );
    const r = await followUp(c.id);
    expect(r.status).toBe('blocked');
    expect(sms.sent).toHaveLength(before);
    expect(await messageCount(c.id)).toBe(0);
    const [act] = await tdb.admin`select summary from activities where contact_id = ${c.id}`;
    expect(act.summary).toContain('blocked');
  });

  it('blocks in quiet hours and offers a retry time inside the window', async () => {
    const before = sms.sent.length;
    const c = await lead(true);
    const r = await followUp(c.id, { now: NIGHT });
    expect(r).toMatchObject({ status: 'blocked', reason: 'quiet_hours' });
    expect((r as { retryAt?: Date }).retryAt).toBeInstanceOf(Date);
    expect(sms.sent).toHaveLength(before);
    expect(await messageCount(c.id)).toBe(0);
  });

  it('blocks when outbound is disabled, whatever else is true', async () => {
    const before = sms.sent.length;
    const c = await lead(true);
    expect(await followUp(c.id, { gate: { outboundEnabled: false } })).toMatchObject({
      status: 'blocked',
      reason: 'outbound_disabled'
    });
    expect(sms.sent).toHaveLength(before);
  });
});
