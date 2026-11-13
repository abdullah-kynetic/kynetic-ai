import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { clearSubscribers, registerEventWorkers, subscribe } from '@/server/events';
import { stopJobs } from '@/server/jobs';
import {
  handleLeadIntake,
  issueLeadWebhookSecret,
  registerLeadProcessor,
  signLeadBody
} from '@/server/leads';
import { clearWebhookProcessors, processWebhookEvent } from '@/server/webhooks';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let appDb: ReturnType<typeof createDb>;
let workerDb: ReturnType<typeof createDb>;
let secretA: string;
let secretB: string;
const emitted: string[] = [];

beforeAll(async () => {
  db = await createTestDatabase({ jobs: true });
  await seedTwoTenants(db.admin);
  appDb = createDb(db.app);
  workerDb = createDb(db.worker);
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = db.urls.app;
  process.env.DATABASE_URL_WORKER = db.urls.worker;
  process.env.DATABASE_URL_AUTH = db.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  secretA = await issueLeadWebhookSecret(IDS.tenantA, { db: workerDb });
  secretB = await issueLeadWebhookSecret(IDS.tenantB, { db: workerDb });
  clearWebhookProcessors();
  registerLeadProcessor();
  clearSubscribers();
  subscribe('lead.created', 'test-collector', async (e) => void emitted.push(e.tenantId));
  await registerEventWorkers({ pollingIntervalSeconds: 0.5 });
});
afterAll(async () => {
  await stopJobs();
  await db?.drop();
});

let ipCounter = 0;
function lead(over: Record<string, unknown> = {}) {
  return {
    externalId: `ext-${Math.random().toString(36).slice(2)}`,
    source: 'website_form',
    firstName: 'Pat',
    lastName: 'Rivera',
    phone: '(555) 010-0142',
    serviceType: 'Roof repair',
    ...over
  };
}

function signedRequest(
  body: unknown,
  opts: { secret?: string; timestamp?: number; raw?: string; ip?: string; signature?: string } = {}
) {
  const raw = opts.raw ?? JSON.stringify(body);
  const ts = opts.timestamp ?? Math.floor(Date.now() / 1000);
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    'x-forwarded-for': opts.ip ?? `203.0.113.${(ipCounter++ % 250) + 1}`,
    'x-kynetic-timestamp': String(ts)
  };
  const signature =
    opts.signature ?? (opts.secret ? signLeadBody(opts.secret, ts, raw) : undefined);
  if (signature) headers['x-kynetic-signature'] = signature;
  return new Request('http://localhost:3000/api/hooks/leads/x', {
    method: 'POST',
    headers,
    body: raw
  });
}

const call = (req: Request, key: string) => handleLeadIntake(req, key, { db: appDb, workerDb });
const status = async (p: Promise<Response>) => {
  try {
    return (await p).status;
  } catch (e) {
    return (e as { status: number }).status;
  }
};
const count = async (table: string) =>
  Number((await db.admin.unsafe(`select count(*)::int as n from ${table}`))[0]!.n);

describe('F-76 lead intake', () => {
  it('authenticates before validation and never persists a lead from an unsupported state', async () => {
    const before = await count('webhook_events');
    const input = lead({
      externalId: 'state-refused-integration',
      phone: '+15555550101',
      businessState: 'FL'
    });
    const invoke = (signed: boolean) =>
      handleLeadIntake(signedRequest(input, signed ? { secret: secretA } : {}), IDS.tenantA, {
        db: appDb,
        workerDb
      });
    expect(await status(invoke(false))).toBe(401);
    expect(await status(invoke(true))).toBe(400);
    expect(await count('webhook_events')).toBe(before);
  });
  it('accepts a valid signed lead, then the worker creates the contact, deal and lead.created', async () => {
    const body = lead({ consent: { capturedText: 'I agree to be called about my quote.' } });
    const res = await call(signedRequest(body, { secret: secretA }), IDS.tenantA);
    expect(res.status).toBe(200);
    const [row] =
      await db.admin`select id from webhook_events where tenant_id = ${IDS.tenantA} and source = 'lead_webhook'`;
    await processWebhookEvent(row!.id, { db: workerDb });

    const [contact] =
      await db.admin`select * from contacts where tenant_id = ${IDS.tenantA} and primary_phone_e164 = '+15550100142'`;
    expect(contact).toMatchObject({ first_name: 'Pat', status: 'new', source: 'website_form' });
    expect(contact!.timezone).toBe('America/Los_Angeles');
    const deals =
      await db.admin`select d.*, dc.contact_id from deals d join deal_contacts dc on dc.deal_id = d.id where d.tenant_id = ${IDS.tenantA} and dc.contact_id = ${contact!.id}`;
    expect(deals).toHaveLength(1);
    expect(deals[0]!.title).toBe('Roof repair - Pat Rivera');
    const consents = await db.admin`select * from consents where contact_id = ${contact!.id}`;
    expect(consents).toHaveLength(1);
    expect(consents[0]).toMatchObject({ channel: 'phone_call', source: 'form' });
    await expectEmitted(1);
  }, 30_000);

  it('a repeat lead for the same phone reuses the contact and adds a deal', async () => {
    const before = await count('contacts');
    const res = await call(signedRequest(lead(), { secret: secretA }), IDS.tenantA);
    expect(res.status).toBe(200);
    const rows =
      await db.admin`select id from webhook_events where tenant_id = ${IDS.tenantA} and source = 'lead_webhook' and processed_at is null`;
    for (const r of rows) await processWebhookEvent(r.id, { db: workerDb });
    expect(await count('contacts')).toBe(before);
    const [{ n }] =
      await db.admin`select count(*)::int as n from deals where tenant_id = ${IDS.tenantA} and title like 'Roof repair - Pat%'`;
    expect(n).toBe(2);
  }, 30_000);

  it('the same lead replayed 10 times is one effect (source plus external id)', async () => {
    const emittedBefore = emitted.length;
    const body = lead({ externalId: 'dup-1', phone: '555-010-0199' });
    for (let i = 0; i < 10; i++) {
      expect(
        await call(signedRequest(body, { secret: secretA }), IDS.tenantA).then((r) => r.status)
      ).toBe(200);
    }
    const events =
      await db.admin`select id from webhook_events where external_id = ${`${IDS.tenantA}:website_form:dup-1`}`;
    expect(events).toHaveLength(1);
    await processWebhookEvent(events[0]!.id, { db: workerDb });
    await expect(processWebhookEvent(events[0]!.id, { db: workerDb })).resolves.toBe(
      'already_processed'
    );
    await expectEmittedCount(emittedBefore + 1);
    const [{ n }] =
      await db.admin`select count(*)::int as n from contacts where primary_phone_e164 = '+15550100199'`;
    expect(n).toBe(1);
  }, 30_000);

  it('the same external id on another tenant is its own lead', async () => {
    const body = lead({ externalId: 'dup-1', phone: '555-010-0198' });
    await call(signedRequest(body, { secret: secretB }), IDS.tenantB);
    const rows =
      await db.admin`select tenant_id from webhook_events where external_id like '%:website_form:dup-1'`;
    expect(rows.map((r) => r.tenant_id).sort()).toEqual([IDS.tenantA, IDS.tenantB].sort());
  });

  it('refuses bad credentials with 401 and writes nothing', async () => {
    const eventsBefore = await count('webhook_events');
    const body = lead();
    const now = Math.floor(Date.now() / 1000);
    const cases: Array<[string, Request, string]> = [
      ['no signature', signedRequest(body), IDS.tenantA],
      ['wrong secret', signedRequest(body, { secret: 'not-the-secret' }), IDS.tenantA],
      ['other tenant secret', signedRequest(body, { secret: secretB }), IDS.tenantA],
      [
        'stale timestamp',
        signedRequest(body, { secret: secretA, timestamp: now - 600 }),
        IDS.tenantA
      ],
      [
        'tampered body',
        signedRequest(body, { secret: secretA, signature: signLeadBody(secretA, now, '{}') }),
        IDS.tenantA
      ],
      [
        'unknown tenant',
        signedRequest(body, { secret: secretA }),
        '33333333-3333-4333-8333-333333333333'
      ],
      ['malformed key', signedRequest(body, { secret: secretA }), 'not-a-uuid']
    ];
    for (const [name, req, key] of cases) expect(await status(call(req, key)), name).toBe(401);
    expect(await count('webhook_events')).toBe(eventsBefore);
  });

  it('stops reading an oversized body even without a Content-Length, before any signature work', async () => {
    const before = await count('webhook_events');
    const chunk = new TextEncoder().encode('x'.repeat(8_000));
    let sent = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        // Would send 10 MB; the server must give up after about 16 KB.
        if (sent++ >= 1_250) return controller.close();
        controller.enqueue(chunk);
      }
    });
    const req = new Request('http://localhost:3000/api/hooks/leads/x', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.250' },
      body: stream,
      duplex: 'half'
    } as RequestInit);
    expect(await status(call(req, IDS.tenantA))).toBe(400);
    expect(sent).toBeLessThan(10);
    expect(await count('webhook_events')).toBe(before);
  });

  it('rejects unknown fields and bad values with 400', async () => {
    for (const bad of [
      lead({ extra: 'x' }),
      lead({ phone: '12' }),
      lead({ phone: undefined, email: undefined }),
      lead({ source: 'Bad Source!' })
    ]) {
      expect(await status(call(signedRequest(bad, { secret: secretA }), IDS.tenantA))).toBe(400);
    }
    const huge = JSON.stringify(lead({ message: 'x'.repeat(20_000) }));
    expect(
      await status(call(signedRequest(null, { secret: secretA, raw: huge }), IDS.tenantA))
    ).toBe(400);
  });

  it('answers 403 MODULE_DISABLED and writes nothing when alex_core is off, other tenants unaffected', async () => {
    await db.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantB} and module_key = 'alex_core'`;
    const before = await count('webhook_events');
    const res = await call(signedRequest(lead(), { secret: secretB }), IDS.tenantB);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('MODULE_DISABLED');
    expect(await count('webhook_events')).toBe(before);
    const ok = await call(
      signedRequest(lead({ phone: '555-010-0177' }), { secret: secretA }),
      IDS.tenantA
    );
    expect(ok.status).toBe(200);
    await db.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantB} and module_key = 'alex_core'`;
  });

  it('rotating the secret stops the old one', async () => {
    const old = secretB;
    secretB = await issueLeadWebhookSecret(IDS.tenantB, { db: workerDb });
    expect(await status(call(signedRequest(lead(), { secret: old }), IDS.tenantB))).toBe(401);
    expect(await status(call(signedRequest(lead(), { secret: secretB }), IDS.tenantB))).toBe(200);
  });

  it('answers 429 over the per-tenant cap, and an unsigned flood writes nothing', async () => {
    const before = await count('webhook_events');
    for (let i = 0; i < 5; i++) {
      expect(await status(call(signedRequest(lead(), { ip: '198.51.100.7' }), IDS.tenantA))).toBe(
        401
      );
    }
    expect(await count('webhook_events')).toBe(before);

    let limited = 0;
    for (let i = 0; i < 70; i++) {
      const s = await status(call(signedRequest(lead(), { secret: secretA }), IDS.tenantA));
      if (s === 429) limited++;
    }
    expect(limited).toBeGreaterThan(0);
  }, 60_000);
});

async function expectEmitted(n: number) {
  const end = Date.now() + 20_000;
  while (Date.now() < end && emitted.length < n) await new Promise((r) => setTimeout(r, 100));
  expect(emitted.length).toBeGreaterThanOrEqual(n);
  expect(emitted[0]).toBe(IDS.tenantA);
}

async function expectEmittedCount(n: number) {
  const end = Date.now() + 20_000;
  while (Date.now() < end && emitted.length < n) await new Promise((r) => setTimeout(r, 100));
  expect(emitted.length).toBe(n);
}
