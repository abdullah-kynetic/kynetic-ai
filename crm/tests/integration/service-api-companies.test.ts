import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { GET as listRoute, POST as createRoute } from '@/app/api/service/companies/route';
import {
  DELETE as deleteRoute,
  GET as getRoute,
  PATCH as patchRoute
} from '@/app/api/service/companies/[id]/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;
let keyN = 0;
let companyB: string;

const headers = (token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
const body = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

async function token(who: 'A' | 'B', scopes: string[]) {
  const c = who === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}

const list = (qs: string, t?: string) =>
  listRoute(
    new Request(`http://localhost/api/service/companies${qs}`, { headers: headers(t, null) })
  );
const create = (v: unknown, t?: string) =>
  createRoute(
    new Request('http://localhost/api/service/companies', {
      method: 'POST',
      headers: headers(t),
      body: body(v)
    })
  );
const detail = (id: string, t?: string) =>
  getRoute(
    new Request(`http://localhost/api/service/companies/${id}`, { headers: headers(t, null) }),
    { params: Promise.resolve({ id }) }
  );
const patch = (id: string, v: unknown, t?: string) =>
  patchRoute(
    new Request(`http://localhost/api/service/companies/${id}`, {
      method: 'PATCH',
      headers: headers(t),
      body: body(v)
    }),
    { params: Promise.resolve({ id }) }
  );
const remove = (id: string, t?: string) =>
  deleteRoute(
    new Request(`http://localhost/api/service/companies/${id}`, {
      method: 'DELETE',
      headers: headers(t)
    }),
    { params: Promise.resolve({ id }) }
  );

const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from companies)::int as companies,
    (select count(*) from companies where deleted_at is null)::int as live,
    (select count(*) from audit_log)::int as audit`;
  return r!;
};

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full')`;
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
  const [co] =
    await tdb.admin`insert into companies (tenant_id, name) values (${IDS.tenantB}, 'B Roofing') returning id`;
  companyB = co!.id;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('companies: auth and scope', () => {
  it('401 without a token; reads need companies:read, writes need companies:write', async () => {
    expect((await list('')).status).toBe(401);
    const readOnly = await token('A', ['companies:read']);
    expect((await list('', readOnly.token)).status).toBe(200);
    expect((await create({ name: 'Nope' }, readOnly.token)).status).toBe(401);
    expect((await patch(a.contactId, { name: 'Nope' }, readOnly.token)).status).toBe(401);
    expect((await remove(companyB, readOnly.token)).status).toBe(401);
  });
});

describe('companies: create, read, edit, delete', () => {
  it('creates a company and lists it with zero contacts and deals', async () => {
    const t = await token('A', ['companies:read', 'companies:write']);
    const c = await counts();
    const res = await create({ name: 'Harbor Dental', phone: '+12025550411' }, t.token);
    expect(res.status).toBe(201);
    const made = (await res.json()).data;
    expect(made).toMatchObject({ name: 'Harbor Dental', phone: '+12025550411' });
    expect((await counts()).companies).toBe(c.companies + 1);
    const page = await (await list('?q=harbor', t.token)).json();
    const row = page.data.find((r: { id: string }) => r.id === made.id);
    expect(row).toMatchObject({ name: 'Harbor Dental', contactCount: 0, dealCount: 0 });
  });

  it('400 without a name, and nothing is written', async () => {
    const t = await token('A', ['companies:write']);
    const c = await counts();
    expect((await create({ phone: '+12025550412' }, t.token)).status).toBe(400);
    expect(await counts()).toEqual(c);
  });

  it('detail returns the company and roll-up; contacts carry no phone or email', async () => {
    const t = await token('A', ['companies:read', 'companies:write']);
    const made = (await (await create({ name: 'Detail Co' }, t.token)).json()).data;
    const res = await detail(made.id, t.token);
    expect(res.status).toBe(200);
    const json = (await res.json()).data;
    expect(json.company.name).toBe('Detail Co');
    expect(json.rollup).toBeDefined();
    expect(Array.isArray(json.contacts)).toBe(true);
    for (const c of json.contacts) {
      expect(c).not.toHaveProperty('primaryPhoneE164');
      expect(c).not.toHaveProperty('primaryEmail');
    }
  });

  it('PATCH changes only the fields sent; an empty body is a 400', async () => {
    const t = await token('A', ['companies:write']);
    const made = (
      await (await create({ name: 'Patch Co', website: 'example.com' }, t.token)).json()
    ).data;
    const res = await patch(made.id, { website: 'https://example.org' }, t.token);
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.name).toBe('Patch Co');
    expect(data.website).toBe('https://example.org/');
    expect((await patch(made.id, {}, t.token)).status).toBe(400);
  });

  it('delete hides the company; it no longer appears in detail', async () => {
    const t = await token('A', ['companies:read', 'companies:write']);
    const made = (await (await create({ name: 'Gone Co' }, t.token)).json()).data;
    expect((await remove(made.id, t.token)).status).toBe(200);
    expect((await detail(made.id, t.token)).status).toBe(404);
  });
});

describe('companies: tenant isolation', () => {
  it("another tenant's company is a 404 for read, edit and delete, and nothing changes", async () => {
    const t = await token('A', ['companies:read', 'companies:write']);
    const c = await counts();
    expect((await detail(companyB, t.token)).status).toBe(404);
    expect((await patch(companyB, { name: 'Hacked' }, t.token)).status).toBe(404);
    expect((await remove(companyB, t.token)).status).toBe(404);
    const [row] = await tdb.admin`select name from companies where id = ${companyB}`;
    expect(row!.name).toBe('B Roofing');
    expect(await counts()).toEqual(c);
  });
});
