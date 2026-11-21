import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { issueServiceToken, ADMIN_CLIENT_HEADER } from '@/server/service-auth';
import { GET as listRoute } from '@/app/api/service/presence/route';
import { PUT as putRoute } from '@/app/api/service/presence/[id]/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let slugA = '';
let itemA: string;
let itemB: string;
let adminKey: string;
let keyN = 0;
const ownerEmail = 'admin@example.test';
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };

const headers = (
  extra: Record<string, string>,
  key: string | null = `pk-${Date.now()}-${keyN++}`
) => ({
  'content-type': 'application/json',
  ...extra,
  ...(key ? { 'idempotency-key': key } : {})
});
const adminHeaders = (): Record<string, string> => ({
  authorization: `Bearer ${adminKey}`,
  [ADMIN_CLIENT_HEADER]: slugA
});
const clientHeaders = (t: string): Record<string, string> => ({ authorization: `Bearer ${t}` });
const withId = (id: string) => ({ params: Promise.resolve({ id }) });
const put = (id: string, body: unknown, h: Record<string, string>) =>
  putRoute(
    new Request(`http://localhost/api/service/presence/${id}`, {
      method: 'PUT',
      headers: headers(h),
      body: JSON.stringify(body)
    }),
    withId(id)
  );
const list = (h: Record<string, string>) =>
  listRoute(new Request('http://localhost/api/service/presence', { headers: headers(h, null) }));

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(tdb.admin));
  await tdb.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  await tdb.admin`delete from tenant_modules where module_key = 'opm' and tenant_id in (${IDS.tenantA}, ${IDS.tenantB})`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'opm', true, ''), (${IDS.tenantB}, 'opm', true, '')`;
  const [ia] = await tdb.admin`insert into presence_items (tenant_id, kind, title, status)
    values (${IDS.tenantA}, 'profile', 'Google profile', 'planned') returning id`;
  const [ib] = await tdb.admin`insert into presence_items (tenant_id, kind, title, status)
    values (${IDS.tenantB}, 'profile', 'B profile', 'planned') returning id`;
  itemA = ia!.id;
  itemB = ib!.id;
  slugA = (await tdb.admin`select slug from tenants where id = ${IDS.tenantA}`)[0]!.slug;
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
  adminKey = (
    await issueAdminKey(owner, { label: 'presence', allowedCidrs: [] }, { db, ownerEmail })
  ).key;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('presence through the owner admin key', () => {
  it('reads and updates the presence items of the client the key acts for', async () => {
    const res = await list(adminHeaders());
    expect(res.status).toBe(200);
    const items = (await res.json()).data.items as { id: string }[];
    expect(items.map((i) => i.id)).toContain(itemA);
    expect(items.map((i) => i.id)).not.toContain(itemB);
    const saved = await put(
      itemA,
      { kind: 'profile', title: 'Google profile, claimed', status: 'done', notes: '' },
      adminHeaders()
    );
    expect(saved.status).toBe(200);
    const [row] = await tdb.admin`select title, status from presence_items where id = ${itemA}`;
    expect(row).toMatchObject({ title: 'Google profile, claimed', status: 'done' });
  });

  it("another tenant's item is a 404 and nothing changes", async () => {
    const res = await put(
      itemB,
      { kind: 'profile', title: 'Hacked', status: 'done', notes: '' },
      adminHeaders()
    );
    expect(res.status).toBe(404);
    const [row] = await tdb.admin`select title from presence_items where id = ${itemB}`;
    expect(row.title).toBe('B profile');
  });

  it('a client token is refused even with the scope ticked, and no token is a 401', async () => {
    const t = await issueServiceToken(
      ctx.ownerA(),
      { label: 'test', scopes: ['reputation:write', 'reputation:read'] },
      { db }
    );
    expect((await list(clientHeaders(t.token))).status).toBe(403);
    expect(
      (
        await put(
          itemA,
          { kind: 'profile', title: 'Client try', status: 'done', notes: '' },
          clientHeaders(t.token)
        )
      ).status
    ).toBe(403);
    const [row] = await tdb.admin`select title from presence_items where id = ${itemA}`;
    expect(row.title).toBe('Google profile, claimed');
    expect((await list({})).status).toBe(401);
  });
});
