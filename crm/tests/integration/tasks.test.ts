import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listActivities } from '@/server/activity';
import { createDb, type Db } from '@/server/db/client';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { ModuleDisabledError } from '@/server/modules';
import {
  completeTask,
  createTask,
  deleteTask,
  listAssignees,
  listEntityTasks,
  listMyTasks,
  reopenTask,
  restoreTask,
  TaskNotFoundError,
  updateTask
} from '@/server/tasks';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let opts: { db: Db };
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
let b: Awaited<ReturnType<typeof seedTwoTenants>>['b'];

// Tenant A runs in America/Los_Angeles. 2026-10-27 18:00Z is 11:00 PDT that day.
const NOW = new Date('2026-10-27T18:00:00Z');

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  // CRM Lite for A; B keeps only the base modules.
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'lite')`;
  db = createDb(tdb.app);
  opts = { db };
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

const iso = (s: string) => new Date(s).toISOString();

describe('M3-02 tasks service (F-20)', () => {
  it('creates a task linked to a contact, assigned to the creator by default, and logs it on the timeline', async () => {
    const t = await createTask(
      ctx.ownerA(),
      {
        title: 'Call back about estimate',
        contactId: a.contactId,
        dueAt: iso('2026-10-27T20:00:00Z')
      },
      opts
    );
    expect(t.assigneeId).toBe(IDS.ownerA);
    expect(t.priority).toBe('normal');
    const tl = await listActivities(
      ctx.ownerA(),
      { contactId: a.contactId, types: ['task'] },
      opts
    );
    expect(tl.items.map((i) => i.summary)).toContain('Task added: Call back about estimate');
  });

  it('lists Overdue, Today and Upcoming for the signed-in user', async () => {
    const mk = (title: string, dueAt: string | null) =>
      createTask(ctx.ownerA(), { title, dueAt }, opts);
    await mk('Overdue one', iso('2026-10-26T20:00:00Z'));
    await mk('Later this week', iso('2026-10-30T20:00:00Z'));
    await mk('No date', null);
    // Someone else's task is not in "mine".
    await createTask(
      ctx.ownerA(),
      { title: 'Staff task', assigneeId: IDS.staffA, dueAt: iso('2026-10-26T20:00:00Z') },
      opts
    );

    const mine = await listMyTasks(ctx.ownerA(), {}, { ...opts, now: NOW });
    expect(mine.overdue.map((t) => t.title)).toEqual(['Overdue one']);
    expect(mine.today.map((t) => t.title)).toEqual(['Call back about estimate']);
    expect(mine.upcoming.map((t) => t.title)).toEqual(['Later this week', 'No date']);
    expect(mine.today[0].contactName).toBe('Contact a');

    const all = await listMyTasks(ctx.ownerA(), { scope: 'all' }, { ...opts, now: NOW });
    expect(all.overdue.map((t) => t.title)).toContain('Staff task');
  });

  it('ends "today" at midnight in the tenant zone, not UTC', async () => {
    // 2026-10-28T06:30Z is 23:30 PDT on the 27th: still today. 07:30Z is 00:30 on the 28th: upcoming.
    await createTask(
      ctx.ownerA(),
      { title: 'Late tonight', dueAt: iso('2026-10-28T06:30:00Z') },
      opts
    );
    await createTask(
      ctx.ownerA(),
      { title: 'Just after midnight', dueAt: iso('2026-10-28T07:30:00Z') },
      opts
    );
    const mine = await listMyTasks(ctx.ownerA(), {}, { ...opts, now: NOW });
    expect(mine.today.map((t) => t.title)).toContain('Late tonight');
    expect(mine.upcoming.map((t) => t.title)).toContain('Just after midnight');
  });

  it('completes, logs it, is idempotent, and reopens as the undo', async () => {
    const t = await createTask(ctx.ownerA(), { title: 'Send quote', contactId: a.contactId }, opts);
    const done = await completeTask(ctx.ownerA(), t.id, opts);
    expect(done.completedAt).not.toBeNull();
    expect(done.completedBy).toBe(IDS.ownerA);
    const again = await completeTask(ctx.ownerA(), t.id, opts);
    expect(again.completedAt).toBe(done.completedAt);

    const events =
      await tdb.admin`select data from pgboss.job where name = 'event.dispatch' and data->>'name' = 'task.completed'`;
    expect(
      events.filter((e) => (e.data as { payload: { taskId: string } }).payload.taskId === t.id)
    ).toHaveLength(1);

    const mine = await listMyTasks(ctx.ownerA(), {}, { ...opts, now: NOW });
    expect([...mine.overdue, ...mine.today, ...mine.upcoming].map((x) => x.id)).not.toContain(t.id);

    const reopened = await reopenTask(ctx.ownerA(), t.id, opts);
    expect(reopened.completedAt).toBeNull();
    expect(reopened.completedBy).toBeNull();
    const back = await listMyTasks(ctx.ownerA(), {}, { ...opts, now: NOW });
    expect([...back.upcoming].map((x) => x.id)).toContain(t.id);

    const tl = await listActivities(
      ctx.ownerA(),
      { contactId: a.contactId, types: ['task'] },
      opts
    );
    const sums = tl.items.map((i) => i.summary);
    expect(sums).toContain('Task completed: Send quote');
    expect(sums).toContain('Task reopened: Send quote');
  });

  it("lists a contact's open tasks and recent completed ones", async () => {
    const r = await listEntityTasks(ctx.ownerA(), { contactId: a.contactId }, opts);
    expect(r.open.length).toBeGreaterThan(0);
    expect(r.open.every((t) => t.contactId === a.contactId && !t.completedAt)).toBe(true);
    await expect(listEntityTasks(ctx.ownerA(), {}, opts)).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates fields, validates the assignee and links, and records an audit row', async () => {
    const t = await createTask(ctx.ownerA(), { title: 'Edit me' }, opts);
    const u = await updateTask(
      ctx.ownerA(),
      t.id,
      { title: 'Edited', priority: 'high', assigneeId: IDS.staffA },
      opts
    );
    expect(u.title).toBe('Edited');
    expect(u.assigneeId).toBe(IDS.staffA);
    await expect(
      updateTask(ctx.ownerA(), t.id, { assigneeId: IDS.ownerB }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createTask(ctx.ownerA(), { title: 'x', contactId: b.contactId }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(createTask(ctx.ownerA(), { title: '   ' }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
    const audits =
      await tdb.admin`select action from audit_log where entity = 'task' and entity_id = ${t.id}`;
    expect(audits.map((r) => r.action).toSorted()).toEqual(['task.create', 'task.update']);
  });

  it('soft-deletes and restores', async () => {
    const t = await createTask(ctx.ownerA(), { title: 'Delete me' }, opts);
    await deleteTask(ctx.ownerA(), t.id, opts);
    await expect(updateTask(ctx.ownerA(), t.id, { title: 'nope' }, opts)).rejects.toBeInstanceOf(
      TaskNotFoundError
    );
    await restoreTask(ctx.ownerA(), t.id, opts);
    await expect(updateTask(ctx.ownerA(), t.id, { title: 'back' }, opts)).resolves.toMatchObject({
      title: 'back'
    });
  });

  it("lists the tenant's members as assignees", async () => {
    const people = await listAssignees(ctx.ownerA(), opts);
    expect(people.map((p) => p.id).toSorted()).toEqual([IDS.ownerA, IDS.staffA].toSorted());
  });
});

describe('M3-02 isolation and module gating (F-20, F-70)', () => {
  it("keeps another tenant's tasks invisible: reads exclude them, writes are 404", async () => {
    const t = await createTask(ctx.ownerA(), { title: 'A only' }, opts);
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${IDS.tenantB}, 'crm', true, 'lite')`;
    try {
      const bAll = await listMyTasks(ctx.ownerB(), { scope: 'all' }, { ...opts, now: NOW });
      const rows = [...bAll.overdue, ...bAll.today, ...bAll.upcoming];
      expect(rows.every((r) => r.tenantId === IDS.tenantB)).toBe(true);
      expect(rows.map((r) => r.id)).not.toContain(t.id);
      await expect(completeTask(ctx.ownerB(), t.id, opts)).rejects.toBeInstanceOf(
        TaskNotFoundError
      );
    } finally {
      await tdb.admin`delete from tenant_modules where tenant_id = ${IDS.tenantB} and module_key = 'crm'`;
    }
  });

  it('refuses every operation without the crm module and writes nothing', async () => {
    const before =
      await tdb.admin`select count(*)::int as n from tasks where tenant_id = ${IDS.tenantB}`;
    await expect(createTask(ctx.ownerB(), { title: 'nope' }, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    await expect(listMyTasks(ctx.ownerB(), {}, opts)).rejects.toBeInstanceOf(ModuleDisabledError);
    await expect(
      listEntityTasks(ctx.ownerB(), { contactId: b.contactId }, opts)
    ).rejects.toBeInstanceOf(ModuleDisabledError);
    const after =
      await tdb.admin`select count(*)::int as n from tasks where tenant_id = ${IDS.tenantB}`;
    expect(after[0].n).toBe(before[0].n);
  });

  it('refuses tenant A once its crm module is switched off, and keeps the data', async () => {
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'crm'`;
    await expect(listMyTasks(ctx.ownerA(), {}, opts)).rejects.toBeInstanceOf(ModuleDisabledError);
    const n =
      await tdb.admin`select count(*)::int as n from tasks where tenant_id = ${IDS.tenantA}`;
    expect(n[0].n).toBeGreaterThan(0);
    await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'crm'`;
  });

  it('is read-only in a view-as session', async () => {
    await expect(
      createTask({ ...ctx.adminViewingA(), readOnly: true }, { title: 'no' }, opts)
    ).rejects.toBeDefined();
  });
});
