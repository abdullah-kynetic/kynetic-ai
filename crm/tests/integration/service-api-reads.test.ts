import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { issueServiceToken } from '@/server/service-auth';
import { GET as listContacts } from '@/app/api/service/contacts/route';
import { GET as getContact } from '@/app/api/service/contacts/[id]/route';
import { GET as contactActivities } from '@/app/api/service/contacts/[id]/activities/route';
import { GET as listPipelines } from '@/app/api/service/pipelines/route';
import { GET as listDeals } from '@/app/api/service/deals/route';
import { GET as getDeal } from '@/app/api/service/deals/[id]/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;

const req = (path: string, token?: string) =>
  new Request(`http://localhost${path}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {}
  });
const idParams = (id: string) => ({ params: Promise.resolve({ id }) });

async function token(owner: 'A' | 'B', scopes: string[]) {
  const c = owner === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}

beforeAll(async () => {
  tdb = await createTestDatabase();
  ({ a, b } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  // Three more contacts and deals for tenant A, newest last, so paging has something to walk.
  for (let i = 1; i <= 3; i++) {
    await tdb.admin`insert into contacts (tenant_id, first_name, last_name, status, updated_at, primary_email, emails)
      values (${IDS.tenantA}, ${`Page${i}`}, 'Walker', ${i === 3 ? 'working' : 'new'}, now() + ${`${i} minutes`}::interval, ${`page${i}@example.test`}, ${[`page${i}@example.test`]})`;
    await tdb.admin`insert into deals (tenant_id, pipeline_id, stage_id, title, position, updated_at)
      values (${IDS.tenantA}, ${a.pipelineId}, ${a.stageId}, ${`Deal ${i}`}, ${`b${i}`}, now() + ${`${i} minutes`}::interval)`;
  }
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

type Route = {
  name: string;
  scope: string;
  call: (tokenValue?: string) => Promise<Response>;
};
const routes = (): Route[] => [
  {
    name: 'contacts',
    scope: 'contacts:read',
    call: (t) => listContacts(req('/api/service/contacts', t))
  },
  {
    name: 'contact detail',
    scope: 'contacts:read',
    call: (t) => getContact(req(`/api/service/contacts/${a.contactId}`, t), idParams(a.contactId))
  },
  {
    name: 'activities',
    scope: 'contacts:read',
    call: (t) =>
      contactActivities(
        req(`/api/service/contacts/${a.contactId}/activities`, t),
        idParams(a.contactId)
      )
  },
  {
    name: 'pipelines',
    scope: 'deals:read',
    call: (t) => listPipelines(req('/api/service/pipelines', t))
  },
  { name: 'deals', scope: 'deals:read', call: (t) => listDeals(req('/api/service/deals', t)) },
  {
    name: 'deal detail',
    scope: 'deals:read',
    call: (t) => getDeal(req(`/api/service/deals/${a.dealId}`, t), idParams(a.dealId))
  }
];

describe('service API reads: auth, scope, rate limit (every route)', () => {
  for (const r of routes()) {
    it(`${r.name}: 401 with no token, with the wrong scope; 200 with the right one`, async () => {
      const none = await r.call();
      expect(none.status).toBe(401);
      const wrong = await token('A', ['metrics:read']);
      expect((await r.call(wrong.token)).status).toBe(401);
      const ok = await token('A', [r.scope]);
      const res = await r.call(ok.token);
      expect(res.status).toBe(200);
      expect((await res.json()).ok).toBe(true);
    });

    it(`${r.name}: rate limited with 429 and Retry-After`, async () => {
      const t = await token('A', [r.scope]);
      let limited: Response | undefined;
      for (let i = 0; i < 250 && !limited; i++) {
        const res = await r.call(t.token);
        if (res.status === 429) limited = res;
      }
      expect(limited).toBeDefined();
      expect(limited!.headers.get('retry-after')).toBeTruthy();
    });
  }
});

describe('service API reads: tenant isolation', () => {
  it("tenant A's token never sees tenant B's contacts or deals", async () => {
    const t = await token('A', ['contacts:read', 'deals:read']);
    const contactsBody = JSON.stringify(
      await (await listContacts(req('/api/service/contacts', t.token))).json()
    );
    expect(contactsBody).not.toContain(b.contactId);
    const dealsBody = JSON.stringify(
      await (await listDeals(req('/api/service/deals', t.token))).json()
    );
    expect(dealsBody).not.toContain(b.dealId);
    const pipes = JSON.stringify(
      await (await listPipelines(req('/api/service/pipelines', t.token))).json()
    );
    expect(pipes).not.toContain(b.pipelineId);
  });

  it('a foreign id is a 404 on detail, activities and deal detail', async () => {
    const t = await token('A', ['contacts:read', 'deals:read']);
    expect(
      (
        await getContact(
          req(`/api/service/contacts/${b.contactId}`, t.token),
          idParams(b.contactId)
        )
      ).status
    ).toBe(404);
    expect(
      (
        await contactActivities(
          req(`/api/service/contacts/${b.contactId}/activities`, t.token),
          idParams(b.contactId)
        )
      ).status
    ).toBe(404);
    expect(
      (await getDeal(req(`/api/service/deals/${b.dealId}`, t.token), idParams(b.dealId))).status
    ).toBe(404);
  });
});

describe('service API reads: shape, paging and validation', () => {
  it('contacts: pages newest first with a cursor, filters, and no phone or email', async () => {
    const t = await token('A', ['contacts:read']);
    const first = await (await listContacts(req('/api/service/contacts?limit=2', t.token))).json();
    expect(first.data).toHaveLength(2);
    expect(first.data[0].firstName).toBe('Page3');
    expect(first.nextCursor).toBeTruthy();
    const second = await (
      await listContacts(req(`/api/service/contacts?limit=2&cursor=${first.nextCursor}`, t.token))
    ).json();
    expect(second.data.length).toBeGreaterThan(0);
    const ids = [...first.data, ...second.data].map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const raw = JSON.stringify(first) + JSON.stringify(second);
    expect(raw).not.toMatch(/\+1555|@example\.test/);
    const filtered = await (
      await listContacts(req('/api/service/contacts?status=working&q=walk', t.token))
    ).json();
    expect(filtered.data).toHaveLength(1);
    expect(filtered.data[0].firstName).toBe('Page3');
    const literal = await (await listContacts(req('/api/service/contacts?q=%25', t.token))).json();
    expect(literal.data).toHaveLength(0);
  });

  it('rejects an oversized limit, a bad cursor, bad dates and unknown parameters with 400', async () => {
    const t = await token('A', ['contacts:read', 'deals:read']);
    for (const path of [
      '/api/service/contacts?limit=101',
      '/api/service/contacts?cursor=garbage',
      '/api/service/contacts?updatedSince=yesterday',
      '/api/service/contacts?tenantId=x',
      '/api/service/deals?status=archived'
    ]) {
      const res = path.includes('deals')
        ? await listDeals(req(path, t.token))
        : await listContacts(req(path, t.token));
      expect(res.status, path).toBe(400);
    }
  });

  it('deals: stage name, status filter, and detail with linked contacts', async () => {
    const t = await token('A', ['deals:read']);
    const list = await (
      await listDeals(req('/api/service/deals?status=open&limit=100', t.token))
    ).json();
    expect(list.data.length).toBe(4);
    expect(list.data[0].stage.name).toBe('New');
    expect(
      (await (await listDeals(req('/api/service/deals?status=won', t.token))).json()).data
    ).toHaveLength(0);
    const detail = await (
      await getDeal(req(`/api/service/deals/${a.dealId}`, t.token), idParams(a.dealId))
    ).json();
    expect(detail.data.title).toBe('Roof replacement');
    expect(detail.data.contacts).toEqual([{ contactId: a.contactId, role: 'homeowner' }]);
  });

  it('pipelines: returns the stages', async () => {
    const t = await token('A', ['deals:read']);
    const body = await (await listPipelines(req('/api/service/pipelines', t.token))).json();
    expect(body.data[0].stages[0]).toMatchObject({ id: a.stageId, name: 'New' });
  });

  it('activities: returns the timeline and rejects an unknown type', async () => {
    const t = await token('A', ['contacts:read']);
    const ok = await (
      await contactActivities(
        req(`/api/service/contacts/${a.contactId}/activities`, t.token),
        idParams(a.contactId)
      )
    ).json();
    expect(ok.data[0].summary).toBe('Seeded');
    const bad = await contactActivities(
      req(`/api/service/contacts/${a.contactId}/activities?types=nonsense`, t.token),
      idParams(a.contactId)
    );
    expect(bad.status).toBe(400);
  });
});

describe('service API reads: audit', () => {
  it('writes a service.read row naming the token, with filter names and never the search text', async () => {
    const t = await token('A', ['contacts:read']);
    await listContacts(req('/api/service/contacts?q=secretname&status=new', t.token));
    const rows = await tdb.admin`select entity, after from audit_log
      where action = 'service.read' and after->>'serviceTokenId' = ${t.id}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].entity).toBe('contacts');
    expect(rows[0].after.filters).toEqual(['q', 'status']);
    expect(JSON.stringify(rows[0].after)).not.toContain('secretname');
  });

  it('detail routes write a service.read row with the entity id', async () => {
    const t = await token('A', ['contacts:read', 'deals:read']);
    await getContact(req(`/api/service/contacts/${a.contactId}`, t.token), idParams(a.contactId));
    await getDeal(req(`/api/service/deals/${a.dealId}`, t.token), idParams(a.dealId));
    const rows = await tdb.admin`select entity, entity_id from audit_log
      where action = 'service.read' and after->>'serviceTokenId' = ${t.id} order by entity`;
    expect(rows.map((r) => [r.entity, r.entity_id])).toEqual([
      ['contact', a.contactId],
      ['deal', a.dealId]
    ]);
  });
});
