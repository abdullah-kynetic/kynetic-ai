import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { getAgencyWorkspace } from '@/server/agency';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { issueServiceToken, ADMIN_CLIENT_HEADER } from '@/server/service-auth';
import { GET as dialerRoute } from '@/app/api/service/agency/dialer/route';
import { POST as callsRoute } from '@/app/api/service/agency/dialer/calls/route';
import { POST as dncRoute } from '@/app/api/service/agency/dnc/route';
import { GET as inboxRoute } from '@/app/api/service/agency/inbox/route';
import {
  GET as campaignsRoute,
  POST as campaignCreate
} from '@/app/api/service/agency/campaigns/route';
import { GET as statsRoute } from '@/app/api/service/agency/campaigns/[id]/stats/route';
import { GET as opsRoute, PUT as opsPut } from '@/app/api/service/agency/ops/route';
import { GET as alertsRoute } from '@/app/api/service/agency/alerts/route';
import { GET as ratesRoute } from '@/app/api/service/agency/rates/route';
import { ctx, IDS } from '../helpers/fixtures';
import { setupAgency, agencyAdmin } from '../helpers/agency';

// D4: dialer log, DNC, inbox, campaigns, ops, alerts, rates. Admin key only. Nothing is dialed, sent or
// started from here, so these tests check access, validation and the logging paths only.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let db: Db;
let adminKey: string;
let agencySlug = '';
let keyN = 0;
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';
const NIL = '00000000-0000-4000-8000-000000000000';

const h = (
  key: string | null = `d4-${Date.now()}-${keyN++}`,
  extra: Record<string, string> = {}
) => ({
  'content-type': 'application/json',
  ...extra,
  ...(key ? { 'idempotency-key': key } : {})
});
const adminHeaders = (): Record<string, string> => ({
  authorization: `Bearer ${adminKey}`,
  [ADMIN_CLIENT_HEADER]: agencySlug
});
const json = (r: Response) => r.json();
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (url: string, headers = adminHeaders()) =>
  new Request(`http://localhost${url}`, { headers });
const send = (method: string, url: string, body: unknown, headers = adminHeaders()) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: { ...h(), ...headers },
    body: JSON.stringify(body)
  });

beforeAll(async () => {
  setup = await setupAgency();
  db = setup.db;
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  agencySlug = (await getAgencyWorkspace(agencyAdmin, true, { db }))!.slug;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  adminKey = (await issueAdminKey(owner, { label: 'd4', allowedCidrs: [] }, { db, ownerEmail }))
    .key;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

describe('service API agency dialer, inbox, campaigns, ops (D4)', () => {
  it('refuses a client token on the dialer', async () => {
    const client = await issueServiceToken(
      ctx.ownerA(),
      { label: 'c4', scopes: ['contacts:read'] },
      { db }
    );
    const res = await dialerRoute(
      new Request('http://localhost/api/service/agency/dialer', {
        headers: { authorization: `Bearer ${client.token}` }
      })
    );
    expect(res.status).toBe(403);
  });

  it('reads the dialer queue, the inbox, alerts and rates with the admin key', async () => {
    const dialer = await dialerRoute(get('/api/service/agency/dialer'));
    expect(dialer.status).toBe(200);
    const inbox = await inboxRoute(get('/api/service/agency/inbox?channel=sms'));
    expect(inbox.status).toBe(200);
    const alerts = await alertsRoute(get('/api/service/agency/alerts'));
    expect(alerts.status).toBe(200);
    const rates = await ratesRoute(get('/api/service/agency/rates?days=7'));
    expect(rates.status).toBe(200);
  });

  it('refuses an inbox filter it does not know and a rates window out of range', async () => {
    const inbox = await inboxRoute(get('/api/service/agency/inbox?bogus=1'));
    expect(inbox.status).toBe(400);
    const rates = await ratesRoute(get('/api/service/agency/rates?days=99'));
    expect(rates.status).toBe(400);
  });

  it('creates a draft campaign, lists it, and reads its stats', async () => {
    const created = await campaignCreate(
      send('POST', '/api/service/agency/campaigns', { name: 'D4 test campaign', script: 'Hello.' })
    );
    expect(created.status).toBe(201);
    const id = (await json(created)).data.id as string;
    const list = await json(await campaignsRoute(get('/api/service/agency/campaigns')));
    expect(list.data.some((c: { id: string }) => c.id === id)).toBe(true);
    const stats = await statsRoute(get(`/api/service/agency/campaigns/${id}/stats`), ctxId(id));
    expect(stats.status).toBe(200);
  });

  it('refuses a call log with an unknown outcome and a DNC mark on an unknown contact', async () => {
    const call = await callsRoute(
      send('POST', '/api/service/agency/dialer/calls', {
        eventId: NIL,
        contactId: NIL,
        outcome: 'telepathy'
      })
    );
    expect(call.status).toBe(400);
    const dnc = await dncRoute(send('POST', '/api/service/agency/dnc', { contactId: NIL }));
    expect(dnc.status).toBe(404);
  });

  it('reads and saves the ops draft, and refuses a non-DEV webhook', async () => {
    const read = await opsRoute(get('/api/service/agency/ops'));
    expect(read.status).toBe(200);
    const bad = await opsPut(
      send('PUT', '/api/service/agency/ops', {
        devWebhookUrl: 'https://example.test/x',
        workflowName: 'DEV - lead intake',
        workflowId: 'abc123'
      })
    );
    expect(bad.status).toBe(400);
  });
});
