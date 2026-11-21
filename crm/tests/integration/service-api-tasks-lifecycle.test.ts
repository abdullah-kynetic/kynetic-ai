import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { POST as complete } from '@/app/api/service/tasks/[id]/complete/route';
import { POST as reopen } from '@/app/api/service/tasks/[id]/reopen/route';
import { POST as restore } from '@/app/api/service/tasks/[id]/restore/route';
import { DELETE as remove } from '@/app/api/service/tasks/[id]/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;
let keyN = 0;
let taskB: string;

const headers = (token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) => ({
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});

async function token(who: 'A' | 'B', scopes: string[]) {
  const c = who === 'A' ? ctx.ownerA() : ctx.ownerB();
  return issueServiceToken(c, { label: 'test', scopes }, { db });
}

const act = (fn: typeof complete, id: string, t?: string) =>
  fn(
    new Request(`http://localhost/api/service/tasks/${id}`, {
      method: 'POST',
      headers: headers(t)
    }),
    { params: Promise.resolve({ id }) }
  );
const del = (id: string, t?: string) =>
  remove(
    new Request(`http://localhost/api/service/tasks/${id}`, {
      method: 'DELETE',
      headers: headers(t)
    }),
    { params: Promise.resolve({ id }) }
  );
const newTask = async (title: string) => {
  const [r] =
    await tdb.admin`insert into tasks (tenant_id, title) values (${IDS.tenantA}, ${title}) returning id`;
  return r!.id as string;
};
const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from tasks where completed_at is not null)::int as done,
    (select count(*) from tasks where deleted_at is not null)::int as deleted,
    (select count(*) from notifications)::int as notifications,
    (select count(*) from pgboss.job where name = 'task.due')::int as due_jobs`;
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
  const [y] =
    await tdb.admin`insert into tasks (tenant_id, title) values (${IDS.tenantB}, 'B task') returning id`;
  taskB = y!.id;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('tasks lifecycle: auth', () => {
  it('401 without tasks:write', async () => {
    const id = await newTask('auth');
    expect((await act(complete, id)).status).toBe(401);
    const read = await token('A', ['tasks:read']);
    expect((await act(complete, id, read.token)).status).toBe(401);
    expect((await del(id, read.token)).status).toBe(401);
  });
});

describe('tasks lifecycle: complete, reopen, delete, restore', () => {
  it('complete marks done; a second complete changes nothing', async () => {
    const t = await token('A', ['tasks:write']);
    const id = await newTask('finish me');
    const first = await act(complete, id, t.token);
    expect(first.status).toBe(200);
    expect((await first.json()).data.status).toBe('done');
    const c = await counts();
    const again = await act(complete, id, t.token);
    expect(again.status).toBe(200);
    expect(await counts()).toEqual(c);
  });

  it('reopen returns a done task to open', async () => {
    const t = await token('A', ['tasks:write']);
    const id = await newTask('reopen me');
    await act(complete, id, t.token);
    const res = await act(reopen, id, t.token);
    expect(res.status).toBe(200);
    expect((await res.json()).data.status).toBe('open');
  });

  it('delete hides the task; restore brings it back', async () => {
    const t = await token('A', ['tasks:write']);
    const id = await newTask('delete me');
    expect((await del(id, t.token)).status).toBe(200);
    const [gone] = await tdb.admin`select deleted_at from tasks where id = ${id}`;
    expect(gone!.deleted_at).not.toBeNull();
    const back = await act(restore, id, t.token);
    expect(back.status).toBe(200);
    const [live] = await tdb.admin`select deleted_at from tasks where id = ${id}`;
    expect(live!.deleted_at).toBeNull();
  });

  it('no reminder is queued for a service-API completion or reopen', async () => {
    const t = await token('A', ['tasks:write']);
    const id = await newTask('no reminder');
    const c = await counts();
    await act(complete, id, t.token);
    await act(reopen, id, t.token);
    expect((await counts()).notifications).toBe(c.notifications);
  });
});

describe('tasks lifecycle: tenant isolation', () => {
  it("another tenant's task is a 404 for every action, and nothing changes", async () => {
    const t = await token('A', ['tasks:write']);
    const c = await counts();
    expect((await act(complete, taskB, t.token)).status).toBe(404);
    expect((await act(reopen, taskB, t.token)).status).toBe(404);
    expect((await act(restore, taskB, t.token)).status).toBe(404);
    expect((await del(taskB, t.token)).status).toBe(404);
    const [row] = await tdb.admin`select title, deleted_at from tasks where id = ${taskB}`;
    expect(row!.title).toBe('B task');
    expect(row!.deleted_at).toBeNull();
    expect(await counts()).toEqual(c);
  });
});
