import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { GET as getCall } from '@/app/api/service/calls/[id]/route';
import { POST as flagRoute } from '@/app/api/service/calls/[id]/flag/route';
import { GET as recordingRoute } from '@/app/api/service/calls/[id]/recording/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let keyN = 0;
let callA: string;
let callB: string;

const headers = (token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});

async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}

const detail = (id: string, t?: string) =>
  getCall(new Request(`http://localhost/api/service/calls/${id}`, { headers: headers(t, null) }), {
    params: Promise.resolve({ id })
  });
const flag = (id: string, v: unknown, t?: string) =>
  flagRoute(
    new Request(`http://localhost/api/service/calls/${id}/flag`, {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(v)
    }),
    { params: Promise.resolve({ id }) }
  );
const recording = (id: string, t?: string) =>
  recordingRoute(
    new Request(`http://localhost/api/service/calls/${id}/recording`, {
      headers: headers(t, null)
    }),
    { params: Promise.resolve({ id }) }
  );

const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from audit_log where action = 'call.flag')::int as flags,
    (select count(*) from pgboss.job where name = 'event.dispatch' and data->>'name' = 'call.flagged')::int as events`;
  return r!;
};

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  const [a] =
    await tdb.admin`insert into calls (tenant_id, provider, provider_call_id, direction, started_at, recording_key, outcome)
    values (${IDS.tenantA}, 'fake', 'c7-a', 'outbound', '2026-01-10T00:30:00Z',
      ${`${IDS.tenantA}/recordings/c7-a.wav`}, 'booked') returning id`;
  const [b] =
    await tdb.admin`insert into calls (tenant_id, provider, provider_call_id, direction, started_at, recording_key, outcome)
    values (${IDS.tenantB}, 'fake', 'c7-b', 'outbound', '2026-01-10T00:30:00Z',
      ${`${IDS.tenantB}/recordings/c7-b.wav`}, 'booked') returning id`;
  callA = a!.id;
  callB = b!.id;
  db = createDb(tdb.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real'
  });
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('calls: scopes', () => {
  it('the recording link needs calls:recording; calls:read alone is refused', async () => {
    const readOnly = await token(['calls:read']);
    expect((await detail(callA, readOnly.token)).status).toBe(200);
    expect((await recording(callA, readOnly.token)).status).toBe(401);
    expect((await detail(callA)).status).toBe(401);
  });
});

describe('calls: detail and recording link', () => {
  it('detail returns no storage key', async () => {
    const t = await token(['calls:read']);
    const data = (await (await detail(callA, t.token)).json()).data;
    expect(data.id).toBe(callA);
    expect(JSON.stringify(data)).not.toContain('recordings/');
  });

  it('recording link is a signed URL that expires in about five minutes', async () => {
    const t = await token(['calls:recording']);
    const res = await recording(callA, t.token);
    expect(res.status).toBe(200);
    const url = new URL((await res.json()).data.url);
    const expires = Number(url.searchParams.get('expires'));
    const inFive = Math.floor(Date.now() / 1000) + 300;
    expect(Math.abs(expires - inFive)).toBeLessThan(10);
  });

  it("another tenant's call is a 404 for detail, flag and recording", async () => {
    const t = await token(['calls:read', 'calls:write', 'calls:recording']);
    const c = await counts();
    expect((await detail(callB, t.token)).status).toBe(404);
    expect((await recording(callB, t.token)).status).toBe(404);
    expect((await flag(callB, {}, t.token)).status).toBe(404);
    expect(await counts()).toEqual(c);
  });
});

describe('calls: flag', () => {
  it('flag is idempotent: the second flag writes no second audit row and sends no second event', async () => {
    const t = await token(['calls:write']);
    const first = await flag(callA, { reason: 'check the disclosure' }, t.token);
    expect(first.status).toBe(200);
    expect((await first.json()).data).toMatchObject({ flagged: true, alreadyFlagged: false });
    const c = await counts();
    const again = await flag(callA, { reason: 'different reason' }, t.token);
    expect((await again.json()).data).toMatchObject({ flagged: true, alreadyFlagged: true });
    expect(await counts()).toEqual(c);
  });

  it('the flag event is tagged service-api', async () => {
    const [job] = await tdb.admin`select data->'payload'->>'origin' as origin from pgboss.job
      where name = 'event.dispatch' and data->>'name' = 'call.flagged'
        and data->'payload'->>'callId' = ${callA} limit 1`;
    expect(job!.origin).toBe('service-api');
  });
});
