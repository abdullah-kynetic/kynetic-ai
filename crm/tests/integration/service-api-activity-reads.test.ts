import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { issueServiceToken } from '@/server/service-auth';
import { GET as listTasks } from '@/app/api/service/tasks/route';
import { GET as listCalls } from '@/app/api/service/calls/route';
import { GET as listAppointments } from '@/app/api/service/appointments/route';
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

async function token(owner: 'A' | 'B', scopes: string[]) {
  const c = owner === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}

beforeAll(async () => {
  tdb = await createTestDatabase();
  ({ a, b } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  for (const [tenant, c] of [
    [IDS.tenantA, a.contactId],
    [IDS.tenantB, b.contactId]
  ] as const) {
    await tdb.admin`insert into appointments (tenant_id, contact_id, starts_at, ends_at, booked_by, notes, address, external_event_id)
      values (${tenant}, ${c}, now() + interval '1 day', now() + interval '1 day 1 hour', 'alex', 'gate code 4417', ${tdb.admin.json({ street: '12 Secret Lane' })}, ${`ext-${tenant}`})`;
  }
  for (let i = 1; i <= 3; i++) {
    await tdb.admin`insert into tasks (tenant_id, title, contact_id, updated_at, completed_at)
      values (${IDS.tenantA}, ${`Task ${i}`}, ${a.contactId}, now() + ${`${i} minutes`}::interval, ${i === 3 ? new Date().toISOString() : null})`;
    await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, outcome, transcript, summary)
      values (${IDS.tenantA}, ${a.contactId}, 'fake', ${`extra-${i}`}, 'inbound', now() + ${`${i} minutes`}::interval, ${i === 3 ? 'booked' : 'no_answer'}, 'secret transcript words', 'secret summary words')`;
  }
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

const routes = [
  {
    name: 'tasks',
    scope: 'tasks:read',
    call: (t?: string) => listTasks(req('/api/service/tasks', t))
  },
  {
    name: 'calls',
    scope: 'calls:read',
    call: (t?: string) => listCalls(req('/api/service/calls', t))
  },
  {
    name: 'appointments',
    scope: 'appointments:read',
    call: (t?: string) => listAppointments(req('/api/service/appointments', t))
  }
];

describe('service API activity reads: auth, scope, rate limit', () => {
  for (const r of routes) {
    it(`${r.name}: 401 with no token and the wrong scope; 200 with the right one`, async () => {
      expect((await r.call()).status).toBe(401);
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

describe('service API activity reads: tenant isolation and shape', () => {
  it("tenant A's token never sees tenant B's rows", async () => {
    const t = await token('A', ['tasks:read', 'calls:read', 'appointments:read']);
    const raw = JSON.stringify([
      await (await listTasks(req('/api/service/tasks?limit=100', t.token))).json(),
      await (await listCalls(req('/api/service/calls?limit=100', t.token))).json(),
      await (await listAppointments(req('/api/service/appointments?limit=100', t.token))).json()
    ]);
    expect(raw).not.toContain(b.contactId);
    expect(raw).toContain(a.contactId);
    const other = await token('B', ['tasks:read']);
    const bBody = JSON.stringify(
      await (await listTasks(req('/api/service/tasks?limit=100', other.token))).json()
    );
    expect(bBody).not.toContain('Task 1');
  });

  it('calls: no transcript, summary, recording or cost; filters and paging work', async () => {
    const t = await token('A', ['calls:read']);
    const first = await (await listCalls(req('/api/service/calls?limit=2', t.token))).json();
    expect(first.data).toHaveLength(2);
    expect(first.nextCursor).toBeTruthy();
    const second = await (
      await listCalls(req(`/api/service/calls?limit=2&cursor=${first.nextCursor}`, t.token))
    ).json();
    const ids = [...first.data, ...second.data].map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const raw = JSON.stringify([first, second]);
    expect(raw).not.toMatch(/secret|transcript|recording|costCents|summary|providerCallId/i);
    const booked = await (
      await listCalls(req('/api/service/calls?outcome=booked', t.token))
    ).json();
    expect(booked.data).toHaveLength(1);
  });

  it('tasks: status filter and paging', async () => {
    const t = await token('A', ['tasks:read']);
    const open = await (
      await listTasks(req('/api/service/tasks?status=open&limit=100', t.token))
    ).json();
    expect(open.data.every((x: { status: string }) => x.status === 'open')).toBe(true);
    const done = await (await listTasks(req('/api/service/tasks?status=done', t.token))).json();
    expect(done.data).toHaveLength(1);
    expect(done.data[0].title).toBe('Task 3');
    const page = await (await listTasks(req('/api/service/tasks?limit=1', t.token))).json();
    expect(page.nextCursor).toBeTruthy();
  });

  it('appointments: no address, notes or external event id', async () => {
    const t = await token('A', ['appointments:read']);
    const body = await (await listAppointments(req('/api/service/appointments', t.token))).json();
    expect(body.data.length).toBeGreaterThanOrEqual(1);
    expect(body.data.every((x: { contactId: string }) => x.contactId === a.contactId)).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(
      /Secret Lane|gate code|ext-|address|notes|externalEventId/i
    );
  });

  it('rejects an oversized limit, a bad cursor, bad dates and unknown parameters with 400', async () => {
    const t = await token('A', ['tasks:read', 'calls:read', 'appointments:read']);
    for (const [fn, path] of [
      [listTasks, '/api/service/tasks?limit=101'],
      [listTasks, '/api/service/tasks?cursor=garbage'],
      [listTasks, '/api/service/tasks?dueBefore=tomorrow'],
      [listCalls, '/api/service/calls?outcome=nope'],
      [listCalls, '/api/service/calls?transcript=1'],
      [listAppointments, '/api/service/appointments?from=soon'],
      [listAppointments, '/api/service/appointments?status=weird']
    ] as const) {
      expect((await fn(req(path, t.token))).status, path).toBe(400);
    }
  });
});

describe('service API activity reads: audit', () => {
  it('writes a service.read row naming the token, with filter names only', async () => {
    const t = await token('A', ['tasks:read', 'calls:read', 'appointments:read']);
    await listTasks(req('/api/service/tasks?status=open', t.token));
    await listCalls(req(`/api/service/calls?contactId=${a.contactId}`, t.token));
    await listAppointments(req('/api/service/appointments?status=scheduled', t.token));
    const rows = await tdb.admin`select entity, after from audit_log
      where action = 'service.read' and after->>'serviceTokenId' = ${t.id} order by entity`;
    expect(rows.map((r) => r.entity)).toEqual(['appointments', 'calls', 'tasks']);
    expect(rows.find((r) => r.entity === 'calls')!.after.filters).toEqual(['contactId']);
    expect(JSON.stringify(rows)).not.toContain(a.contactId);
  });
});
