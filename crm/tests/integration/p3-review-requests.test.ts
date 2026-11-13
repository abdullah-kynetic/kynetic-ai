import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import { recordConsent, revokeConsent } from '@/server/consent';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { requestReview, sendReviewRequest } from '@/server/reviews';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// P3-4: review requests are queued, gated, logged, and only sent when the flag is on.

const A_NUMBER = '+15555550100';
const NOON = new Date('2026-10-26T19:00:00Z');
const NIGHT = new Date('2026-10-27T06:00:00Z');
const gate = { outboundEnabled: true };

let tdb: TestDatabase;
let appDb: Db;
let n = 0;
const sms = new FakeSmsProvider();
const email = new FakeEmailProvider();
const deps = (over: object = {}) => ({
  envEnabled: true,
  now: NOON,
  gate,
  smsProvider: sms,
  emailProvider: email,
  ...over
});

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  appDb = createDb(tdb.app);
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
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, config) values (${IDS.tenantA}, 'opm', true, '{"review_url":"https://g.page/r/example/review"}'::jsonb) on conflict (tenant_id, module_key) do update set enabled = true, config = excluded.config`;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

async function queued(channel: 'sms' | 'email', consent = true) {
  n += 1;
  const [c] =
    await tdb.admin`insert into contacts (tenant_id, first_name, primary_phone_e164, primary_email, timezone)
    values (${IDS.tenantA}, ${'Pat' + n}, ${'+1555555' + String(7000 + n)}, ${`pat${n}@example.test`}, 'America/Los_Angeles') returning id`;
  if (consent) {
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
  const r = await requestReview(
    ctx.ownerA(),
    { contactId: c.id, channel },
    { db: appDb, now: NOON }
  );
  return { contactId: c.id as string, requestId: r.id };
}
const job = (requestId: string) => ({ tenantId: IDS.tenantA, requestId });
const statusOf = async (id: string) =>
  (await tdb.admin`select status from review_requests where id = ${id}`)[0].status as string;

describe('P3-4 review requests', () => {
  it('queues a request and sends nothing while the flag is off', async () => {
    const a = await queued('sms');
    sms.sent.length = 0;
    expect(await sendReviewRequest(job(a.requestId), deps({ envEnabled: false }))).toBe('flag_off');
    expect(await statusOf(a.requestId)).toBe('queued');
    expect(sms.sent).toHaveLength(0);
  });

  it('sends a text through the gate when the flag is on, then marks it sent and logs it', async () => {
    const a = await queued('sms');
    sms.sent.length = 0;
    expect(await sendReviewRequest(job(a.requestId), deps())).toBe('sent');
    expect(sms.sent).toHaveLength(1);
    expect(sms.sent[0].body).toContain('https://g.page/r/example/review');
    expect(await statusOf(a.requestId)).toBe('sent');
    const acts = await tdb.admin`select summary from activities where contact_id = ${a.contactId}`;
    expect(acts.some((x) => String(x.summary).startsWith('Review request sent'))).toBe(true);
    // A second run does nothing: it is no longer queued.
    expect(await sendReviewRequest(job(a.requestId), deps())).toBe('not_queued');
    expect(sms.sent).toHaveLength(1);
  });

  it('sends an email request too', async () => {
    const a = await queued('email');
    email.sent.length = 0;
    expect(await sendReviewRequest(job(a.requestId), deps())).toBe('sent');
    expect(email.sent).toHaveLength(1);
  });

  it('holds during quiet hours and while sending is off, and sends nothing', async () => {
    const a = await queued('sms');
    sms.sent.length = 0;
    expect(await sendReviewRequest(job(a.requestId), deps({ now: NIGHT }))).toBe('held');
    expect(
      await sendReviewRequest(job(a.requestId), deps({ gate: { outboundEnabled: false } }))
    ).toBe('held');
    expect(await statusOf(a.requestId)).toBe('queued');
    expect(sms.sent).toHaveLength(0);
  });

  it('cancels and logs when consent was withdrawn after queueing', async () => {
    const a = await queued('sms');
    await revokeConsent(
      ctx.ownerA(),
      { contactId: a.contactId, channel: 'sms', source: 'staff', capturedText: 'asked' },
      { db: appDb }
    );
    sms.sent.length = 0;
    expect(await sendReviewRequest(job(a.requestId), deps())).toBe('cancelled');
    expect(await statusOf(a.requestId)).toBe('cancelled');
    expect(sms.sent).toHaveLength(0);
    const acts = await tdb.admin`select summary from activities where contact_id = ${a.contactId}`;
    expect(acts.some((x) => String(x.summary).startsWith('Review request cancelled'))).toBe(true);
  });

  it('leaves a request queued when there is no review link', async () => {
    const a = await queued('sms');
    await tdb.admin`update tenant_modules set config = '{}'::jsonb where tenant_id = ${IDS.tenantA} and module_key = 'opm'`;
    try {
      expect(await sendReviewRequest(job(a.requestId), deps())).toBe('no_link');
    } finally {
      await tdb.admin`update tenant_modules set config = '{"review_url":"https://g.page/r/example/review"}'::jsonb where tenant_id = ${IDS.tenantA} and module_key = 'opm'`;
    }
    expect(await statusOf(a.requestId)).toBe('queued');
  });

  it('a request with no consent is refused at queue time', async () => {
    await expect(queued('sms', false)).rejects.toThrow();
  });
});
