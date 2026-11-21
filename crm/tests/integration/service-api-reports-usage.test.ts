import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { GET as notifRoute } from '@/app/api/service/notifications/route';
import { POST as notifReadRoute } from '@/app/api/service/notifications/read/route';
import { GET as reportsRoute } from '@/app/api/service/reports/route';
import { GET as reportRoute } from '@/app/api/service/reports/[id]/route';
import { POST as generateRoute } from '@/app/api/service/reports/generate/route';
import { GET as usageRoute } from '@/app/api/service/usage/route';
import { GET as searchRoute } from '@/app/api/service/search/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// C12 notifications, reports, usage and search: scopes, unread count and mark-read, one report per
// month, usage month validation, and search needing a query.

let tdb: TestDatabase;
let db: Db;
let keyN = 0;

const headers = (token?: string, key: string | null = `c12-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const get = (route: (r: Request) => Promise<Response>, path: string, t?: string) =>
  route(new Request(`http://localhost${path}`, { headers: headers(t, null) }));

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  await tdb.admin`delete from tenant_modules where module_key in ('crm', 'platform') and tenant_id = ${IDS.tenantA}`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'crm', true, 'full'),
    (${IDS.tenantA}, 'platform', true, '')`;
  await tdb.admin`insert into notifications (tenant_id, user_id, kind, title, body)
    values (${IDS.tenantA}, null, 'new_lead', 'Welcome to the portal', 'Tenant-wide notice')`;
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

describe('service API notifications, reports, usage and search (C12)', () => {
  it('needs the matching scope for each route', async () => {
    const none = await token([]);
    expect((await get(notifRoute, '/api/service/notifications', none.token)).status).toBe(401);
    expect((await get(usageRoute, '/api/service/usage', none.token)).status).toBe(401);
    expect((await get(searchRoute, '/api/service/search?q=x', none.token)).status).toBe(401);
  });

  it('reports the unread count and marks the owner notifications read', async () => {
    const reader = await token(['notifications:read']);
    const before = await (await get(notifRoute, '/api/service/notifications', reader.token)).json();
    expect(before.data.unread).toBeGreaterThanOrEqual(1);
    const marked = await notifReadRoute(
      new Request('http://localhost/api/service/notifications/read', {
        method: 'POST',
        headers: headers(reader.token)
      })
    );
    expect(marked.status).toBe(200);
    const after = await (
      await get(notifRoute, '/api/service/notifications?unread=1', reader.token)
    ).json();
    expect(after.data.unread).toBe(0);
    expect(after.data.items).toHaveLength(0);
  });

  it('generates one report per month and reads it back', async () => {
    const writer = await token(['reports:read', 'reports:write']);
    const gen = (key: string) =>
      generateRoute(
        new Request('http://localhost/api/service/reports/generate', {
          method: 'POST',
          headers: headers(writer.token, key),
          body: JSON.stringify({ periodStart: '2026-10-01' })
        })
      );
    const first = await gen(`r1-${Date.now()}`);
    const second = await gen(`r2-${Date.now()}`);
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const id = (await first.json()).data.id;
    expect((await second.json()).data.id).toBe(id);
    const listed = await (await get(reportsRoute, '/api/service/reports', writer.token)).json();
    expect(listed.data.filter((r: { id: string }) => r.id === id)).toHaveLength(1);
    const one = await reportRoute(
      new Request(`http://localhost/api/service/reports/${id}`, {
        headers: headers(writer.token, null)
      }),
      withId(id)
    );
    expect((await one.json()).data.id).toBe(id);
  });

  it('refuses a bad report period and a bad usage month', async () => {
    const writer = await token(['reports:write', 'usage:read']);
    const bad = await generateRoute(
      new Request('http://localhost/api/service/reports/generate', {
        method: 'POST',
        headers: headers(writer.token),
        body: JSON.stringify({ periodStart: 'October' })
      })
    );
    expect(bad.status).toBe(400);
    expect((await get(usageRoute, '/api/service/usage?month=2026-13', writer.token)).status).toBe(
      400
    );
    expect((await get(usageRoute, '/api/service/usage?month=2026-10', writer.token)).status).toBe(
      200
    );
  });

  it('search needs a query and returns a result shape', async () => {
    const reader = await token(['contacts:read']);
    expect((await get(searchRoute, '/api/service/search', reader.token)).status).toBe(400);
    const res = await get(searchRoute, '/api/service/search?q=zz-no-such-name', reader.token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.total).toBe(0);
  });
});
