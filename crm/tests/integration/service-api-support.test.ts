import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { GET as listRoute, POST as createRoute } from '@/app/api/service/support/route';
import { GET as threadRoute } from '@/app/api/service/support/[id]/route';
import { POST as replyRoute } from '@/app/api/service/support/[id]/reply/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// C11 support: scopes, sanitized text, owner attribution, own-tenant threads and replies.

let tdb: TestDatabase;
let db: Db;
let keyN = 0;

const headers = (token?: string, key: string | null = `sup-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
async function token(scopes: string[], tenant: 'A' | 'B' = 'A') {
  const who = tenant === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(who, { label: 'test', scopes }, { db });
}
const withId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  await tdb.admin`delete from tenant_modules where module_key = 'crm' and tenant_id in (${IDS.tenantA}, ${IDS.tenantB})`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'crm', true, 'full'),
    (${IDS.tenantB}, 'crm', true, 'full')`;
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

const list = (t?: string) =>
  listRoute(new Request('http://localhost/api/service/support', { headers: headers(t, null) }));
const create = (body: unknown, t?: string, key?: string | null) =>
  createRoute(
    new Request('http://localhost/api/service/support', {
      method: 'POST',
      headers: headers(t, key === undefined ? undefined : key),
      body: JSON.stringify(body)
    })
  );
const thread = (id: string, t?: string) =>
  threadRoute(
    new Request(`http://localhost/api/service/support/${id}`, { headers: headers(t, null) }),
    withId(id)
  );
const reply = (id: string, body: unknown, t?: string) =>
  replyRoute(
    new Request(`http://localhost/api/service/support/${id}/reply`, {
      method: 'POST',
      headers: headers(t),
      body: JSON.stringify(body)
    }),
    withId(id)
  );

describe('service API support (C11)', () => {
  it('needs support:read to list and support:write to open or reply', async () => {
    const reader = await token(['support:read']);
    expect((await list(reader.token)).status).toBe(200);
    expect((await create({ subject: 'Hi', body: 'Hello' }, reader.token)).status).toBe(401);
    expect((await list(undefined)).status).toBe(401);
  });

  it('opens a request with sanitized text, the default category and an owner attribution', async () => {
    const writer = await token(['support:read', 'support:write']);
    const made = await create(
      { subject: 'Check <b>this</b>', body: 'Line one\u0007 <script>x</script>' },
      writer.token
    );
    expect(made.status).toBe(201);
    const { data } = await made.json();
    const got = await (await thread(data.id, writer.token)).json();
    expect(got.data.subject).toBe('Check bthis/b');
    expect(got.data.body).toBe('Line one scriptx/script');
    expect(got.data.category).toBe('general');
    const submitted =
      await tdb.admin`select submitted_by from support_requests where id = ${data.id}`;
    const owner =
      await tdb.admin`select user_id from memberships where tenant_id = ${IDS.tenantA} and role = 'owner' order by created_at limit 1`;
    expect(submitted[0]!.submitted_by).toBe(owner[0]!.user_id);
  });

  it('adds a client reply to a request, sanitized, and shows it on the thread', async () => {
    const writer = await token(['support:read', 'support:write']);
    const { data } = await (
      await create({ subject: 'Reply me', body: 'First' }, writer.token)
    ).json();
    const res = await reply(data.id, { body: 'Thanks <i>all</i>' }, writer.token);
    expect(res.status).toBe(201);
    const got = await (await thread(data.id, writer.token)).json();
    expect(got.data.messages).toHaveLength(1);
    expect(got.data.messages[0].authorSide).toBe('client');
    expect(got.data.messages[0].body).toBe('Thanks iall/i');
  });

  it('a request in another tenant is 404 for read and reply', async () => {
    const writer = await token(['support:read', 'support:write']);
    const { data } = await (
      await create({ subject: 'Tenant A only', body: 'A' }, writer.token)
    ).json();
    const other = await token(['support:read', 'support:write'], 'B');
    expect((await thread(data.id, other.token)).status).toBe(404);
    expect((await reply(data.id, { body: 'Nope' }, other.token)).status).toBe(404);
  });

  it('a repeated open with the same Idempotency-Key stores one request', async () => {
    const writer = await token(['support:read', 'support:write']);
    const key = `sup-idem-${Date.now()}`;
    const first = await create({ subject: 'Once only', body: 'Body' }, writer.token, key);
    const second = await create({ subject: 'Once only', body: 'Body' }, writer.token, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(first.status);
    const listed = await (await list(writer.token)).json();
    expect(listed.data.filter((d: { subject: string }) => d.subject === 'Once only')).toHaveLength(
      1
    );
  });
});
