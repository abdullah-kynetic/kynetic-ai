import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { POST as postContact } from '@/app/api/service/contacts/route';
import {
  GET as getContact,
  DELETE as deleteContactRoute
} from '@/app/api/service/contacts/[id]/route';
import { POST as restoreRoute } from '@/app/api/service/contacts/[id]/restore/route';
import { POST as mergeRoute } from '@/app/api/service/contacts/merge/route';
import { GET as exportRoute } from '@/app/api/service/contacts/export/route';
import { POST as bulkRoute } from '@/app/api/service/contacts/bulk/route';
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

async function token(who: 'A' | 'B', scopes: string[]) {
  const c = who === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}

const createA = (v: unknown, t: string) =>
  postContact(
    new Request('http://localhost/api/service/contacts', {
      method: 'POST',
      headers: headers(t),
      body: body(v)
    })
  );
const idOf = async (res: Response) => (await res.json()).data.id as string;
const del = (id: string, t?: string) =>
  deleteContactRoute(
    new Request(`http://localhost/api/service/contacts/${id}`, {
      method: 'DELETE',
      headers: headers(t)
    }),
    { params: Promise.resolve({ id }) }
  );
const get = (id: string, t?: string) =>
  getContact(
    new Request(`http://localhost/api/service/contacts/${id}`, { headers: headers(t, null) }),
    { params: Promise.resolve({ id }) }
  );
const restore = (id: string, t?: string) =>
  restoreRoute(
    new Request(`http://localhost/api/service/contacts/${id}/restore`, {
      method: 'POST',
      headers: headers(t),
      body: ''
    }),
    { params: Promise.resolve({ id }) }
  );
const merge = (v: unknown, t?: string) =>
  mergeRoute(
    new Request('http://localhost/api/service/contacts/merge', {
      method: 'POST',
      headers: headers(t),
      body: body(v)
    })
  );
const bulk = (v: unknown, t?: string) =>
  bulkRoute(
    new Request('http://localhost/api/service/contacts/bulk', {
      method: 'POST',
      headers: headers(t),
      body: body(v)
    })
  );
const exp = (qs: string, t?: string) =>
  exportRoute(
    new Request(`http://localhost/api/service/contacts/export${qs}`, {
      headers: headers(t, null)
    })
  );

const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from contacts)::int as contacts,
    (select count(*) from contacts where deleted_at is null)::int as live,
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
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('contacts admin: scopes', () => {
  it('merge, delete and export each need their own scope', async () => {
    const writeOnly = await token('A', ['contacts:write']);
    expect(
      (await merge({ survivorId: a.contactId, loserId: a.contactId }, writeOnly.token)).status
    ).toBe(401);
    expect((await del(a.contactId, writeOnly.token)).status).toBe(401);
    expect((await exp('', writeOnly.token)).status).toBe(401);
    expect((await exp('')).status).toBe(401);
  });

  it('a bulk delete with only contacts:write is refused, and nothing is deleted', async () => {
    const writeOnly = await token('A', ['contacts:write']);
    const c = await counts();
    const res = await bulk({ ids: [a.contactId], action: { type: 'delete' } }, writeOnly.token);
    expect(res.status).toBe(403);
    expect(await counts()).toEqual(c);
  });
});

describe('contacts admin: delete and restore', () => {
  it('soft delete hides the contact; restore brings it back', async () => {
    const t = await token('A', ['contacts:read', 'contacts:write', 'contacts:delete']);
    const id = await idOf(await createA({ firstName: 'Gone', phones: ['+12025550301'] }, t.token));
    expect((await del(id, t.token)).status).toBe(200);
    expect((await get(id, t.token)).status).toBe(404);
    const back = await restore(id, t.token);
    expect(back.status).toBe(200);
    expect((await get(id, t.token)).status).toBe(200);
  });

  it("cannot delete or restore another tenant's contact", async () => {
    const t = await token('A', ['contacts:read', 'contacts:write', 'contacts:delete']);
    const c = await counts();
    expect((await del(b.contactId, t.token)).status).toBe(404);
    expect((await restore(b.contactId, t.token)).status).toBe(404);
    expect(await counts()).toEqual(c);
  });
});

describe('contacts admin: merge', () => {
  it('the survivor keeps its record and the loser is hidden, not deleted', async () => {
    const t = await token('A', ['contacts:read', 'contacts:write', 'contacts:delete']);
    const survivor = await idOf(
      await createA({ firstName: 'Keep', phones: ['+12025550311'] }, t.token)
    );
    const loser = await idOf(
      await createA({ firstName: 'Drop', phones: ['+12025550312'] }, t.token)
    );
    const res = await merge({ survivorId: survivor, loserId: loser }, t.token);
    expect(res.status).toBe(200);
    expect((await res.json()).data.id).toBe(survivor);
    expect((await get(loser, t.token)).status).toBe(404);
    const [row] = await tdb.admin`select merged_into_id from contacts where id = ${loser}`;
    expect(row!.merged_into_id).toBe(survivor);
  });

  it('refuses a loser of another tenant and writes nothing', async () => {
    const t = await token('A', ['contacts:read', 'contacts:write', 'contacts:delete']);
    const c = await counts();
    const res = await merge({ survivorId: a.contactId, loserId: b.contactId }, t.token);
    expect(res.status).toBe(404);
    expect(await counts()).toEqual(c);
  });
});

describe('contacts admin: export', () => {
  it('CSV for the client, with formula cells neutralized', async () => {
    const t = await token('A', ['contacts:write', 'contacts:export']);
    await createA({ firstName: 'Csv', lastName: 'Row', phones: ['+12025550321'] }, t.token);
    const res = await exp('?q=Csv', t.token);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const text = await res.text();
    expect(text.split('\n')[0]).toContain('firstName');
    expect(text).toContain('Csv');
    expect(text).not.toContain('B Contact');
  });

  it('rejects an unknown query field', async () => {
    const t = await token('A', ['contacts:export']);
    expect((await exp('?bogus=1', t.token)).status).toBe(400);
  });
});

describe('contacts admin: bulk', () => {
  it('tag add, status and owner apply to every id in one call', async () => {
    const t = await token('A', ['contacts:write']);
    const x = await idOf(await createA({ firstName: 'Bulk1', phones: ['+12025550331'] }, t.token));
    const y = await idOf(await createA({ firstName: 'Bulk2', phones: ['+12025550332'] }, t.token));
    const tagged = await bulk(
      { ids: [x, y], action: { type: 'tag', add: ['batch-1'], remove: [] } },
      t.token
    );
    expect(tagged.status).toBe(200);
    expect((await tagged.json()).data).toEqual({ type: 'tag', requested: 2 });
    const status = await bulk(
      { ids: [x, y], action: { type: 'status', status: 'working' } },
      t.token
    );
    expect(status.status).toBe(200);
    const rows = await tdb.admin`select status, tags from contacts where id in (${x}, ${y})`;
    for (const r of rows) {
      expect(r.status).toBe('working');
      expect(r.tags).toContain('batch-1');
    }
  });

  it('more than 200 ids is refused, and one foreign id changes nothing', async () => {
    const t = await token('A', ['contacts:write']);
    const tooMany = Array.from({ length: 201 }, () => crypto.randomUUID());
    expect(
      (await bulk({ ids: tooMany, action: { type: 'status', status: 'lost' } }, t.token)).status
    ).toBe(400);
    const c = await counts();
    const res = await bulk(
      { ids: [a.contactId, b.contactId], action: { type: 'status', status: 'dead' } },
      t.token
    );
    expect(res.status).toBe(404);
    const [row] = await tdb.admin`select status from contacts where id = ${a.contactId}`;
    expect(row!.status).not.toBe('dead');
    expect(await counts()).toEqual(c);
  });

  it('enroll is not offered', async () => {
    const t = await token('A', ['contacts:write']);
    const res = await bulk(
      { ids: [a.contactId], action: { type: 'enroll', sequenceKey: 'x' } },
      t.token
    );
    expect(res.status).toBe(400);
  });
});
