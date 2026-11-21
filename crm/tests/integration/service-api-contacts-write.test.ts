import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { POST as postContact } from '@/app/api/service/contacts/route';
import { PATCH as patchContact } from '@/app/api/service/contacts/[id]/route';
import { POST as addTags, DELETE as removeTags } from '@/app/api/service/contacts/[id]/tags/route';
import { PUT as putOwner } from '@/app/api/service/contacts/[id]/owner/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;
let keyN = 0;

const headers = (token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
const body = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));

const create = (v: unknown, token?: string, key?: string | null) =>
  postContact(
    new Request('http://localhost/api/service/contacts', {
      method: 'POST',
      headers: headers(token, key),
      body: body(v)
    })
  );
const patch = (id: string, v: unknown, token?: string, key?: string | null) =>
  patchContact(
    new Request(`http://localhost/api/service/contacts/${id}`, {
      method: 'PATCH',
      headers: headers(token, key),
      body: body(v)
    }),
    { params: Promise.resolve({ id }) }
  );
const tags = (id: string, method: 'POST' | 'DELETE', v: unknown, token?: string) => {
  const handler = method === 'POST' ? addTags : removeTags;
  return handler(
    new Request(`http://localhost/api/service/contacts/${id}/tags`, {
      method,
      headers: headers(token),
      body: body(v)
    }),
    { params: Promise.resolve({ id }) }
  );
};
const owner = (id: string, v: unknown, token?: string) =>
  putOwner(
    new Request(`http://localhost/api/service/contacts/${id}/owner`, {
      method: 'PUT',
      headers: headers(token),
      body: body(v)
    }),
    { params: Promise.resolve({ id }) }
  );

async function token(who: 'A' | 'B', scopes: string[]) {
  const c = who === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}

const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from contacts)::int as contacts,
    (select count(*) from audit_log)::int as audit`;
  return r!;
};

const PHONE = '+12025550147';
let contactA: string;
let contactB: string;
let staffA: string;
let companyB: string;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'lite')`;
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
  contactA = a.contactId;
  contactB = b.contactId;
  staffA = IDS.staffA;
  const [co] =
    await tdb.admin`insert into companies (tenant_id, name) values (${IDS.tenantB}, 'B Co') returning id`;
  companyB = co!.id;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('contacts write: auth and scope', () => {
  it('401 with no token and with a token that lacks contacts:write', async () => {
    expect((await create({ firstName: 'x', phones: [PHONE] })).status).toBe(401);
    expect((await patch(contactA, { firstName: 'x' })).status).toBe(401);
    expect((await tags(contactA, 'POST', { tags: ['x'] })).status).toBe(401);
    expect((await owner(contactA, { ownerId: null })).status).toBe(401);
    const wrong = await token('A', ['contacts:read', 'tasks:write']);
    expect((await create({ firstName: 'x', phones: [PHONE] }, wrong.token)).status).toBe(401);
    expect((await patch(contactA, { firstName: 'x' }, wrong.token)).status).toBe(401);
  });
});

describe('contacts write: create', () => {
  it('201 with a DTO that leaves out phone and email; the write is tagged and audited', async () => {
    const t = await token('A', ['contacts:write']);
    const c = await counts();
    const res = await create(
      {
        firstName: 'Dana',
        lastName: 'Lee',
        phones: [PHONE],
        emails: ['dana@example.com'],
        tags: ['warm']
      },
      t.token
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toMatchObject({ firstName: 'Dana', lastName: 'Lee', tags: ['warm'] });
    expect(json.data).not.toHaveProperty('phones');
    expect(json.data).not.toHaveProperty('emails');
    expect(json.data).not.toHaveProperty('primaryPhoneE164');
    expect((await counts()).contacts).toBe(c.contacts + 1);
    expect((await counts()).audit).toBeGreaterThan(c.audit);
  });

  it('400 with neither phone nor email, and nothing is written', async () => {
    const t = await token('A', ['contacts:write']);
    const c = await counts();
    expect((await create({ firstName: 'No contact' }, t.token)).status).toBe(400);
    expect(await counts()).toEqual(c);
  });

  it('409 for a duplicate phone, and the duplicate goes through only with acknowledgeDuplicates', async () => {
    const t = await token('A', ['contacts:write']);
    const c = await counts();
    expect((await create({ firstName: 'Twin', phones: [PHONE] }, t.token)).status).toBe(409);
    expect(await counts()).toEqual(c);
    const ok = await create(
      { firstName: 'Twin', phones: [PHONE], acknowledgeDuplicates: true },
      t.token
    );
    expect(ok.status).toBe(201);
  });

  it('400 for a field the API does not accept', async () => {
    const t = await token('A', ['contacts:write']);
    expect((await create({ phones: [PHONE], unknownField: 1 }, t.token)).status).toBe(400);
    expect((await create({ phones: [PHONE], acknowledgeDuplicates: 'yes' }, t.token)).status).toBe(
      400
    );
  });
});

describe('contacts write: edit, tags, owner', () => {
  it('PATCH changes only the fields sent', async () => {
    const t = await token('A', ['contacts:write']);
    const res = await patch(contactA, { status: 'working' }, t.token);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.status).toBe('working');
    expect(json.data).not.toHaveProperty('phones');
  });

  it('tags add and remove; adding the same tag twice changes nothing more', async () => {
    const t = await token('A', ['contacts:write']);
    const add = await tags(contactA, 'POST', { tags: ['Hot', 'Hot', 'roofing'] }, t.token);
    expect(add.status).toBe(200);
    const once = (await add.json()).data.tags as string[];
    expect(once).toEqual(expect.arrayContaining(['Hot', 'roofing']));
    const again = await tags(contactA, 'POST', { tags: ['hot'] }, t.token);
    expect((await again.json()).data.tags).toEqual(once);
    const removed = await tags(contactA, 'DELETE', { tags: ['ROOFING'] }, t.token);
    expect((await removed.json()).data.tags).not.toContain('roofing');
  });

  it('owner set and clear; an owner from another tenant is refused and nothing changes', async () => {
    const t = await token('A', ['contacts:write']);
    const set = await owner(contactA, { ownerId: staffA }, t.token);
    expect(set.status).toBe(200);
    expect((await set.json()).data.ownerId).toBe(staffA);
    const cleared = await owner(contactA, { ownerId: null }, t.token);
    expect((await cleared.json()).data.ownerId).toBeNull();
    const foreign = await owner(contactA, { ownerId: IDS.ownerB }, t.token);
    expect([400, 404]).toContain(foreign.status);
    const [row] = await tdb.admin`select owner_id from contacts where id = ${contactA}`;
    expect(row!.owner_id).toBeNull();
  });
});

describe('contacts write: tenant isolation', () => {
  it("cannot edit, tag or re-own another tenant's contact", async () => {
    const t = await token('A', ['contacts:write']);
    const c = await counts();
    expect((await patch(contactB, { firstName: 'hacked' }, t.token)).status).toBe(404);
    expect((await tags(contactB, 'POST', { tags: ['x'] }, t.token)).status).toBe(404);
    expect((await tags(contactB, 'DELETE', { tags: ['x'] }, t.token)).status).toBe(404);
    expect((await owner(contactB, { ownerId: null }, t.token)).status).toBe(404);
    expect((await patch(crypto.randomUUID(), { firstName: 'x' }, t.token)).status).toBe(404);
    const [row] = await tdb.admin`select first_name from contacts where id = ${contactB}`;
    expect(row!.first_name).not.toBe('hacked');
    expect(await counts()).toEqual(c);
  });

  it('a company of another tenant is a 404 and nothing is written', async () => {
    const t = await token('A', ['contacts:write']);
    const c = await counts();
    expect(
      (await create({ firstName: 'x', phones: ['+12025550199'], companyId: companyB }, t.token))
        .status
    ).toBe(404);
    expect(await counts()).toEqual(c);
  });
});
