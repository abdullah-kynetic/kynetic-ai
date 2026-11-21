import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import {
  GET as pauseRead,
  PUT as pauseWrite
} from '@/app/api/service/platform/outbound-pause/route';
import { PUT as spendCap } from '@/app/api/service/platform/clients/[id]/spend-cap/route';
import { PUT as emailFlags } from '@/app/api/service/platform/clients/[id]/email-flags/route';
import { POST as suspend } from '@/app/api/service/platform/clients/[id]/suspend/route';
import { GET as jobs } from '@/app/api/service/platform/jobs/route';
import { POST as onboardRoute } from '@/app/api/service/platform/clients/route';
import { IDS } from '../helpers/fixtures';
import { setupAgency } from '../helpers/agency';

// E3: safety controls. The API can pause outbound, lower a cap, switch email off and suspend. It cannot
// turn outbound on, raise or remove a cap, switch email on, or reinstate a client.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let adminKey: string;
let clientId = '';
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';
const bearer = () => ({ authorization: `Bearer ${adminKey}`, 'content-type': 'application/json' });
const put = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: 'PUT',
    headers: bearer(),
    body: JSON.stringify(body)
  });
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  setup = await setupAgency();
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = setup.db;
  adminKey = (
    await issueAdminKey(owner, { label: 'e3', allowedCidrs: [] }, { db: setup.db, ownerEmail })
  ).key;
  const created = await onboardRoute(
    new Request('http://localhost/api/service/platform/clients', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({
        businessName: 'E3 Controls Co',
        ownerEmail: 'owner-e3@example.test',
        phone: '+12025550102',
        industry: 'roofing',
        timezone: 'America/Chicago',
        hours: { days: ['mon'], open: '08:00', close: '17:00' },
        plan: 'value',
        modules: []
      })
    })
  );
  clientId = (await created.json()).data.tenantId as string;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

describe('service API platform safety controls (E3)', () => {
  it('pauses outbound, and the pause is idempotent', async () => {
    const first = await pauseWrite(
      put('/api/service/platform/outbound-pause', { paused: true, reason: 'test' })
    );
    expect(first.status).toBe(200);
    const again = await pauseWrite(
      put('/api/service/platform/outbound-pause', { paused: true, reason: 'test' })
    );
    expect(again.status).toBe(200);
    const read = await pauseRead(
      new Request('http://localhost/api/service/platform/outbound-pause', { headers: bearer() })
    );
    expect(read.status).toBe(200);
  });

  it('refuses to turn outbound back on', async () => {
    const res = await pauseWrite(put('/api/service/platform/outbound-pause', { paused: false }));
    expect(res.status).toBe(403);
  });

  it('sets a spend cap once, lowers it, and refuses to raise it', async () => {
    const set = await spendCap(
      put(`/api/service/platform/clients/${clientId}/spend-cap`, { cents: 50000 }),
      ctxId(clientId)
    );
    expect(set.status).toBe(200);
    const lower = await spendCap(
      put(`/api/service/platform/clients/${clientId}/spend-cap`, { cents: 40000 }),
      ctxId(clientId)
    );
    expect(lower.status).toBe(200);
    const raise = await spendCap(
      put(`/api/service/platform/clients/${clientId}/spend-cap`, { cents: 60000 }),
      ctxId(clientId)
    );
    expect(raise.status).toBe(403);
    const remove = await spendCap(
      put(`/api/service/platform/clients/${clientId}/spend-cap`, { cents: null }),
      ctxId(clientId)
    );
    expect(remove.status).toBe(403);
  });

  it('switches email off but refuses to switch it on', async () => {
    const off = await emailFlags(
      put(`/api/service/platform/clients/${clientId}/email-flags`, {
        weekly: false,
        report: false
      }),
      ctxId(clientId)
    );
    expect(off.status).toBe(200);
    const on = await emailFlags(
      put(`/api/service/platform/clients/${clientId}/email-flags`, { weekly: true, report: false }),
      ctxId(clientId)
    );
    expect(on.status).toBe(403);
  });

  it('suspends a client and lists jobs', async () => {
    const res = await suspend(
      new Request(`http://localhost/api/service/platform/clients/${clientId}/suspend`, {
        method: 'POST',
        headers: bearer()
      }),
      ctxId(clientId)
    );
    expect(res.status).toBe(200);
    const list = await jobs(
      new Request('http://localhost/api/service/platform/jobs', { headers: bearer() })
    );
    expect(list.status).toBe(200);
  });
});
