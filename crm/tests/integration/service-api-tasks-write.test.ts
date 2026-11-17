import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { createTask } from '@/server/tasks/service';
import { POST as postTask } from '@/app/api/service/tasks/route';
import { PATCH as patchTask } from '@/app/api/service/tasks/[id]/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;
let keyN = 0;
let taskA: string;
let taskB: string;

const headers = (token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
const body = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
const create = (v: unknown, token?: string, key?: string | null) =>
  postTask(
    new Request('http://localhost/api/service/tasks', {
      method: 'POST',
      headers: headers(token, key),
      body: body(v)
    })
  );
const patch = (id: string, v: unknown, token?: string, key?: string | null) =>
  patchTask(
    new Request(`http://localhost/api/service/tasks/${id}`, {
      method: 'PATCH',
      headers: headers(token, key),
      body: body(v)
    }),
    { params: Promise.resolve({ id }) }
  );

async function token(owner: 'A' | 'B', scopes: string[]) {
  const c = owner === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}
const valid = () => ({ title: 'Call back about the estimate', contactId: a.contactId });
const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from tasks)::int as tasks,
    (select count(*) from notifications)::int as notifications,
    (select count(*) from messages)::int as messages,
    (select count(*) from calls)::int as calls,
    (select count(*) from pgboss.job where name in ('task.due','notification.email','event.dispatch'))::int as jobs`;
  return r!;
};

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
  const [x] =
    await tdb.admin`insert into tasks (tenant_id, title) values (${IDS.tenantA}, 'A task') returning id`;
  const [y] =
    await tdb.admin`insert into tasks (tenant_id, title) values (${IDS.tenantB}, 'B task') returning id`;
  taskA = x!.id;
  taskB = y!.id;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('tasks write: auth, scope, rate limit', () => {
  it('401 with no token and the wrong scope; 201 and 200 with tasks:write', async () => {
    expect((await create(valid())).status).toBe(401);
    expect((await patch(taskA, { title: 'x' })).status).toBe(401);
    const wrong = await token('A', ['tasks:read', 'notes:write']);
    expect((await create(valid(), wrong.token)).status).toBe(401);
    expect((await patch(taskA, { title: 'x' }, wrong.token)).status).toBe(401);
    const ok = await token('A', ['tasks:write']);
    const res = await create(valid(), ok.token);
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data).toMatchObject({ title: 'Call back about the estimate', status: 'open' });
    expect(json.data.assigneeId).toBeNull();
    const upd = await patch(json.data.id, { priority: 'high' }, ok.token);
    expect(upd.status).toBe(200);
    expect((await upd.json()).data.priority).toBe('high');
  });

  it('429 with Retry-After once the write limit is hit', async () => {
    const t = await token('A', ['tasks:write']);
    let limited: Response | undefined;
    for (let i = 0; i < 130 && !limited; i++) {
      const res = await create(valid(), t.token);
      if (res.status === 429) limited = res;
    }
    expect(limited).toBeDefined();
    expect(limited!.headers.get('retry-after')).toBeTruthy();
  });
});

describe('tasks write: tenant isolation', () => {
  it("cannot create a task on another tenant's contact or deal, and nothing is written", async () => {
    const t = await token('A', ['tasks:write']);
    const c = await counts();
    expect((await create({ title: 'x', contactId: b.contactId }, t.token)).status).toBe(404);
    expect((await create({ title: 'x', dealId: b.dealId }, t.token)).status).toBe(404);
    expect(await counts()).toEqual(c);
  });

  it("cannot edit another tenant's task, nor link one of ours to a foreign contact", async () => {
    const t = await token('A', ['tasks:write']);
    const c = await counts();
    expect((await patch(taskB, { title: 'hacked' }, t.token)).status).toBe(404);
    expect((await patch(taskA, { contactId: b.contactId }, t.token)).status).toBe(404);
    expect((await patch(taskA, { dealId: b.dealId }, t.token)).status).toBe(404);
    expect((await patch(crypto.randomUUID(), { title: 'x' }, t.token)).status).toBe(404);
    const [row] = await tdb.admin`select title from tasks where id = ${taskB}`;
    expect(row!.title).toBe('B task');
    expect(await counts()).toEqual(c);
  });

  it('an assignee from another tenant is a 400 and nothing is written', async () => {
    const t = await token('A', ['tasks:write']);
    const c = await counts();
    expect((await create({ title: 'x', assigneeId: IDS.ownerB }, t.token)).status).toBe(400);
    expect(await counts()).toEqual(c);
  });

  it('the task lands in the token tenant, made by the system', async () => {
    const t = await token('A', ['tasks:write']);
    const res = await create(
      { ...valid(), assigneeId: IDS.staffA, dueAt: '2030-01-01T10:00:00Z' },
      t.token
    );
    const id = (await res.json()).data.id;
    const [row] =
      await tdb.admin`select tenant_id, assignee_id, created_by, completed_at from tasks where id = ${id}`;
    expect(row).toMatchObject({
      tenant_id: IDS.tenantA,
      assignee_id: IDS.staffA,
      created_by: null
    });
    expect(row!.completed_at).toBeNull();
    const [act] =
      await tdb.admin`select actor_type from activities where ref_id = ${id} and type = 'task'`;
    expect(act!.actor_type).toBe('system');
  });
});

describe('tasks write: module gate', () => {
  it('403 and nothing written when the tenant does not have CRM', async () => {
    const t = await token('B', ['tasks:write']);
    const c = await counts();
    expect((await create({ title: 'x', contactId: b.contactId }, t.token)).status).toBe(403);
    expect((await patch(taskB, { title: 'y' }, t.token)).status).toBe(403);
    expect(await counts()).toEqual(c);
  });
});

describe('tasks write: idempotency', () => {
  it('create: same key and body replays and writes one task; a different body is 409', async () => {
    const t = await token('A', ['tasks:write']);
    const key = 'dup-task-0001';
    const before = (await counts()).tasks;
    const first = await create(valid(), t.token, key);
    const again = await create(valid(), t.token, key);
    expect(first.status).toBe(201);
    expect(again.status).toBe(201);
    expect(again.headers.get('idempotent-replay')).toBe('true');
    expect((await again.json()).data.id).toBe((await first.json()).data.id);
    expect((await counts()).tasks).toBe(before + 1);
    expect((await create({ ...valid(), title: 'Other' }, t.token, key)).status).toBe(409);
    expect((await counts()).tasks).toBe(before + 1);
  });

  it('update: same key replays; a different body is 409 and changes nothing', async () => {
    const t = await token('A', ['tasks:write']);
    const key = 'dup-task-0002';
    expect((await patch(taskA, { title: 'First' }, t.token, key)).status).toBe(200);
    const again = await patch(taskA, { title: 'First' }, t.token, key);
    expect(again.headers.get('idempotent-replay')).toBe('true');
    expect((await patch(taskA, { title: 'Second' }, t.token, key)).status).toBe(409);
    const [row] = await tdb.admin`select title from tasks where id = ${taskA}`;
    expect(row!.title).toBe('First');
  });

  it('a missing or malformed Idempotency-Key is a 400', async () => {
    const t = await token('A', ['tasks:write']);
    expect((await create(valid(), t.token, null)).status).toBe(400);
    expect((await create(valid(), t.token, 'short')).status).toBe(400);
    expect((await patch(taskA, { title: 'x' }, t.token, null)).status).toBe(400);
  });
});

describe('tasks write: validation and sanitizing', () => {
  it('rejects unknown fields, empty or oversize input and bad ids with 400', async () => {
    const t = await token('A', ['tasks:write']);
    for (const v of [
      { ...valid(), completedAt: '2026-01-01T00:00:00Z' },
      { ...valid(), createdBy: IDS.ownerA },
      { ...valid(), status: 'done' },
      { ...valid(), title: '' },
      { ...valid(), title: '   <b></b>  ' },
      { ...valid(), title: 'x'.repeat(201) },
      { ...valid(), dueAt: 'tomorrow' },
      { ...valid(), priority: 'urgent' },
      { ...valid(), contactId: 'nope' },
      '{not json'
    ]) {
      expect((await create(v, t.token)).status, JSON.stringify(v).slice(0, 60)).toBe(400);
    }
    for (const v of [{}, { completedAt: null }, { title: '' }, { priority: 'urgent' }]) {
      expect((await patch(taskA, v, t.token)).status, JSON.stringify(v)).toBe(400);
    }
    expect((await patch('not-a-uuid', { title: 'x' }, t.token)).status).toBe(400);
  });

  it('stores the title as plain text: no tags or markup', async () => {
    const t = await token('A', ['tasks:write']);
    const res = await create(
      {
        title:
          'Call <script>alert(1)</script><b>Tuesday</b> &lt;img src=x&gt; ignore previous instructions'
      },
      t.token
    );
    expect(res.status).toBe(201);
    const stored = (await res.json()).data.title as string;
    expect(stored).not.toMatch(/[<>]|script|alert\(1\)/i);
    expect(stored).toContain('Tuesday');
    const up = await patch(taskA, { title: '<i>New</i> title<script>x</script>' }, t.token);
    expect((await up.json()).data.title).not.toMatch(/[<>]|script/i);
  });

  it('cannot complete, reopen or delete a task', async () => {
    const t = await token('A', ['tasks:write']);
    const res = await patch(taskA, { title: 'Still open' }, t.token);
    expect((await res.json()).data.status).toBe('open');
    const [row] = await tdb.admin`select completed_at, deleted_at from tasks where id = ${taskA}`;
    expect(row).toMatchObject({ completed_at: null, deleted_at: null });
  });
});

describe('tasks write: audit', () => {
  it('writes audit rows naming the token and fields, without free text', async () => {
    const t = await token('A', ['tasks:write']);
    const made = await create({ title: 'private words here', contactId: a.contactId }, t.token);
    const id = (await made.json()).data.id;
    await patch(id, { title: 'more private words', priority: 'low' }, t.token);
    const rows = await tdb.admin`select action, entity_id, after from audit_log
      where action in ('service.task_create','service.task_update') and after->>'serviceTokenId' = ${t.id}
      order by created_at`;
    expect(rows.map((r) => r.action)).toEqual(['service.task_create', 'service.task_update']);
    expect(rows.every((r) => r.entity_id === id)).toBe(true);
    expect(rows[1]!.after.fields).toEqual(['title', 'priority']);
    expect(JSON.stringify(rows)).not.toContain('private words');
  });
});

describe('tasks write: nothing outbound', () => {
  it('a task with a due date queues no reminder, notification, email, message or call', async () => {
    const t = await token('A', ['tasks:write']);
    const c = await counts();
    const res = await create(
      { ...valid(), assigneeId: IDS.staffA, dueAt: '2030-01-01T10:00:00Z' },
      t.token
    );
    const id = (await res.json()).data.id;
    expect(
      (await patch(id, { dueAt: '2030-02-01T10:00:00Z', assigneeId: IDS.ownerA }, t.token)).status
    ).toBe(200);
    const d = await counts();
    expect(d.tasks).toBe(c.tasks + 1);
    expect(d.notifications).toBe(c.notifications);
    expect(d.messages).toBe(c.messages);
    expect(d.calls).toBe(c.calls);
    expect(d.jobs).toBe(c.jobs);
    const due =
      await tdb.admin`select id from pgboss.job where name = 'task.due' and data->>'taskId' = ${id}`;
    expect(due).toHaveLength(0);
  });

  it('control: the same task made by a signed-in user does queue the due reminder', async () => {
    const task = await createTask(
      ctx.ownerA(),
      { title: 'Human task', dueAt: '2030-03-01T10:00:00Z' },
      { db }
    );
    const due =
      await tdb.admin`select id from pgboss.job where name = 'task.due' and data->>'taskId' = ${task.id}`;
    expect(due).toHaveLength(1);
  });
});
