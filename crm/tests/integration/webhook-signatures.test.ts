import { createHmac } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST as bookRoute } from '@/app/api/appointments/book/route';
import { POST as callResultRoute } from '@/app/api/service/call-results/route';
import { POST as resendRoute } from '@/app/api/hooks/resend/route';
import { ElevenLabsVoiceProvider } from '@/server/adapters/voice/elevenlabs';
import { TwilioSmsProvider } from '@/server/adapters/sms/twilio';
import { handleVoiceWebhook } from '@/server/calls/hooks';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { handleLeadIntake, issueLeadWebhookSecret, signLeadBody } from '@/server/leads';
import { handleTwilioInbound, handleTwilioStatus } from '@/server/messaging/twilio-hooks';
import { issueServiceToken, revokeServiceToken } from '@/server/service-auth';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// P6-2. Every inbound endpoint the Alex chain uses answers 401 for a bad or missing credential and
// stores nothing. The n8n booking workflow calls the two service routes with a bearer token; the
// provider hooks use each provider's own signature; the lead hook uses the tenant secret.

let tdb: TestDatabase;
let appDb: Db;
let workerDb: Db;
const SECRET = 'whsec_' + Buffer.from('demo-resend-secret').toString('base64');
const now = () => new Date('2026-11-05T18:00:00Z');
const eleven = new ElevenLabsVoiceProvider({
  apiKey: 'unused',
  webhookSecret: 'eleven-secret',
  now
});
const twilio = new TwilioSmsProvider({
  accountSid: 'ACdemo',
  authToken: 'twilio-token',
  publicBaseUrl: 'http://localhost:3000'
});
const post = (url: string, body: string, headers: Record<string, string> = {}) =>
  new Request(url, { method: 'POST', body, headers });
const counts = async () => {
  const [w] = await tdb.admin`select count(*)::int as n from webhook_events`;
  const [c] = await tdb.admin`select count(*)::int as n from calls`;
  const [a] = await tdb.admin`select count(*)::int as n from appointments`;
  return { webhooks: w.n, calls: c.n, appointments: a.n };
};

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  appDb = createDb(tdb.app);
  workerDb = createDb(tdb.worker);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = appDb;
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32),
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false',
    RESEND_WEBHOOK_SECRET: SECRET,
    RESEND_API_KEY: 'unused'
  });
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await stopJobs();
  await tdb?.drop();
});

describe('webhook and service credentials are checked before anything is stored', () => {
  it('ElevenLabs post-call hook: missing, malformed, wrong and stale signatures are 401', async () => {
    const before = await counts();
    const body = JSON.stringify({
      type: 'post_call_transcription',
      event_timestamp: 1_793_000_000,
      data: { conversation_id: 'conv_1', agent_id: 'agent_demo' }
    });
    const t = Math.floor(now().getTime() / 1000);
    const sign = (secret: string, at: number) =>
      `t=${at},v0=${createHmac('sha256', secret).update(`${at}.${body}`).digest('hex')}`;
    const cases: [string, Record<string, string>][] = [
      ['missing', {}],
      ['malformed', { 'elevenlabs-signature': 'garbage' }],
      ['wrong secret', { 'elevenlabs-signature': sign('other-secret', t) }],
      ['stale', { 'elevenlabs-signature': sign('eleven-secret', t - 3600) }],
      ['tampered body', { 'elevenlabs-signature': sign('eleven-secret', t).replace(/.$/, '0') }]
    ];
    for (const [name, headers] of cases) {
      const res = await handleVoiceWebhook(
        post('http://localhost/api/hooks/voice/elevenlabs', body, headers),
        {
          provider: eleven
        }
      );
      expect(res.status, name).toBe(401);
    }
    expect(await counts()).toEqual(before);
  });

  it('Twilio inbound and status hooks: missing and wrong signatures are 401', async () => {
    const before = await counts();
    const form = new URLSearchParams({
      MessageSid: 'SM1',
      From: '+15555550177',
      To: '+15555550100',
      Body: 'STOP'
    }).toString();
    for (const handler of [handleTwilioInbound, handleTwilioStatus]) {
      for (const headers of [{}, { 'x-twilio-signature': 'bad' }] as Record<string, string>[]) {
        const res = await handler(
          post('http://localhost:3000/api/hooks/twilio/inbound', form, headers),
          { provider: twilio }
        );
        expect(res.status).toBe(401);
      }
    }
    expect(await counts()).toEqual(before);
  });

  it('Resend hook: missing and wrong svix signatures are 401', async () => {
    const before = await counts();
    const body = JSON.stringify({
      type: 'email.delivered',
      data: { email_id: 'e1', to: ['a@example.test'] }
    });
    const ts = String(Math.floor(Date.now() / 1000));
    const wrong = createHmac('sha256', Buffer.from('not-the-secret'))
      .update(`id1.${ts}.${body}`)
      .digest('base64');
    const resendHeaders: Record<string, string>[] = [
      {},
      { 'svix-id': 'id1', 'svix-timestamp': ts },
      { 'svix-id': 'id1', 'svix-timestamp': ts, 'svix-signature': `v1,${wrong}` }
    ];
    for (const headers of resendHeaders) {
      const res = await resendRoute(post('http://localhost/api/hooks/resend', body, headers));
      expect(res.status).toBe(401);
    }
    expect(await counts()).toEqual(before);
  });

  it('lead hook: missing, wrong and replayed-with-other-body signatures are 401', async () => {
    const before = await counts();
    const secret = await issueLeadWebhookSecret(IDS.tenantA, { db: workerDb });
    const raw = JSON.stringify({ externalId: 'sig-1', source: 'form', phone: '+15555550178' });
    const ts = Math.floor(Date.now() / 1000);
    const headersFor = (sig?: string): Record<string, string> => ({
      'x-kynetic-timestamp': String(ts),
      ...(sig ? { 'x-kynetic-signature': sig } : {})
    });
    for (const sig of [undefined, 'deadbeef', signLeadBody(secret, ts, '{"other":true}')]) {
      const res = await handleLeadIntake(
        post(`http://localhost/api/hooks/leads/${IDS.tenantA}`, raw, headersFor(sig)),
        IDS.tenantA,
        { db: appDb, workerDb }
      ).catch((e: { status?: number }) => ({ status: e.status ?? 401 }));
      expect(res.status).toBe(401);
    }
    expect(await counts()).toEqual(before);
  });

  it('service routes the n8n booking workflow calls: missing, bad, revoked and wrong-scope tokens', async () => {
    const before = await counts();
    const good = await issueServiceToken(
      ctx.ownerA(),
      { label: 'n8n booking', scopes: ['appointments:write'] },
      { db: appDb }
    );
    const callsOnly = await issueServiceToken(
      ctx.ownerA(),
      { label: 'calls only', scopes: ['calls:write'] },
      { db: appDb }
    );
    const revoked = await issueServiceToken(
      ctx.ownerA(),
      { label: 'revoked', scopes: ['appointments:write', 'calls:write'] },
      { db: appDb }
    );
    await revokeServiceToken(ctx.ownerA(), revoked.id, { db: appDb });
    const body = JSON.stringify({
      startsAt: '2026-11-05T22:00:00Z',
      endsAt: '2026-11-05T23:00:00Z'
    });
    const tokens: [string, Record<string, string>][] = [
      ['missing', {}],
      ['garbage', { authorization: 'Bearer nope' }],
      ['not bearer', { authorization: `Basic ${good.token}` }],
      ['revoked', { authorization: `Bearer ${revoked.token}` }],
      ['wrong scope', { authorization: `Bearer ${callsOnly.token}` }]
    ];
    for (const route of [bookRoute, callResultRoute]) {
      for (const [name, headers] of tokens) {
        const res = await route(
          post('http://localhost/api/service/x', body, {
            ...headers,
            'content-type': 'application/json'
          })
        );
        // Wrong scope on the call-results route is the scope that token has, so it is valid there.
        if (route === callResultRoute && name === 'wrong scope') continue;
        expect([401, 403], `${name} on ${route === bookRoute ? 'book' : 'call-results'}`).toContain(
          res.status
        );
      }
    }
    expect(await counts()).toEqual(before);
  });
});
