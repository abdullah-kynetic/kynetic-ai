import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { createTask, deliverTaskDue } from '@/server/tasks';

let tdb: TestDatabase;
let db: Db;
let contactId: string;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  const seeded = await seedTwoTenants(tdb.admin);
  contactId = seeded.a.contactId;
  await tdb.admin`
    insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'lite')`;
  db = createDb(tdb.app);
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});

afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('M3-04 task due reminders', () => {
  it('notifies the assignee once and schedules the due job', async () => {
    const task = await createTask(
      ctx.ownerA(),
      {
        title: 'Call overdue lead',
        contactId,
        dueAt: new Date(Date.now() - 60_000).toISOString()
      },
      { db }
    );

    const jobs = await tdb.admin`
      select data from pgboss.job where name = 'task.due' and data->>'taskId' = ${task.id}`;
    expect(jobs).toHaveLength(1);
    expect(await deliverTaskDue({ tenantId: IDS.tenantA, taskId: task.id }, { db })).toBe(true);
    expect(await deliverTaskDue({ tenantId: IDS.tenantA, taskId: task.id }, { db })).toBe(false);

    const rows = await tdb.admin`
      select user_id, kind, title from notifications
      where tenant_id = ${IDS.tenantA} and link = ${`/dashboard/tasks?task=${task.id}`}`;
    expect(rows).toEqual([
      { user_id: IDS.ownerA, kind: 'task_due', title: 'Task due: Call overdue lead' }
    ]);
  });

  it('does not notify completed or not-yet-due tasks', async () => {
    const future = await createTask(
      ctx.ownerA(),
      { title: 'Future follow-up', dueAt: new Date(Date.now() + 86_400_000).toISOString() },
      { db }
    );
    expect(await deliverTaskDue({ tenantId: IDS.tenantA, taskId: future.id }, { db })).toBe(false);

    const done = await createTask(
      ctx.ownerA(),
      { title: 'Done follow-up', dueAt: new Date(Date.now() - 60_000).toISOString() },
      { db }
    );
    await tdb.admin`update tasks set completed_at = now() where id = ${done.id}`;
    expect(await deliverTaskDue({ tenantId: IDS.tenantA, taskId: done.id }, { db })).toBe(false);
  });
});
