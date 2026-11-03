import { and, asc, desc, eq, isNotNull, isNull, sql } from 'drizzle-orm';
import { recordActivity } from '../activity';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import { contacts, deals, memberships, tasks, tenantModules, tenants, users } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { emitEvent } from '../events';
import { ModuleDisabledError } from '../modules';
import { moduleSatisfied, type CrmLevel, type ModuleKey } from '../modules/keys';
import { withTenant, type TenantContextInput } from '../tenancy';
import { scheduleTaskDue } from './due';
import { parseInput, uuidSchema } from '../validation';
import {
  createTaskSchema,
  listEntityTasksSchema,
  listMyTasksSchema,
  updateTaskSchema,
  type CreateTaskInput,
  type ListEntityTasksInput,
  type ListMyTasksInput,
  type UpdateTaskInput
} from './schemas';

// Tasks service (M3-02; PRD F-20; DATABASE tasks). CRM Lite: every function checks the module first.
// Each runs through withTenant, so RLS is the last line of tenant isolation and a read-only view-as
// session cannot write. Pass `tx` to join a caller's transaction, or `db` in tests. Events carry
// ids only (ARCHITECTURE section 6).

export type Task = typeof tasks.$inferSelect;
export type TaskOpts = { db?: Db; tx?: Tx };

/** A task with the names the list shows. */
export type TaskRow = Task & {
  contactName: string | null;
  assigneeName: string | null;
};

export type MyTasks = {
  overdue: TaskRow[];
  today: TaskRow[];
  /** Due after today, then tasks with no due date. */
  upcoming: TaskRow[];
};

function run<T>(ctx: TenantContextInput, opts: TaskOpts, fn: (tx: Tx) => Promise<T>) {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

const actorOf = (ctx: TenantContextInput) => ({ type: 'user' as const, id: ctx.userId });
const now = () => sql`now()` as unknown as string;

export class TaskNotFoundError extends AppError {
  constructor() {
    super('NOT_FOUND');
    this.name = 'TaskNotFoundError';
  }
}

/** Tasks belong to CRM Lite (PRD F-20, F-85). Reads the flag in the caller's transaction. */
async function requireCrmLite(tx: Tx) {
  const rows = await tx
    .select({ key: tenantModules.moduleKey, level: tenantModules.level })
    .from(tenantModules)
    .where(and(eq(tenantModules.moduleKey, 'crm'), eq(tenantModules.enabled, true)));
  const level = rows[0]?.level;
  const crmLevel: CrmLevel | null = level === 'lite' || level === 'full' ? level : null;
  const enabled = { keys: new Set<ModuleKey>(rows.length ? ['crm'] : []), crmLevel };
  if (!moduleSatisfied(enabled, { module: 'crm', level: 'lite' })) {
    throw new ModuleDisabledError('crm', 'lite');
  }
}

async function assertAssignee(tx: Tx, userId: string | null | undefined) {
  if (!userId) return;
  const [m] = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.userId, userId))
    .limit(1);
  if (!m) throw new ValidationError({ assigneeId: ['not_a_member'] });
}

async function assertLinks(tx: Tx, contactId?: string | null, dealId?: string | null) {
  if (contactId) {
    const [c] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
      .limit(1);
    if (!c) throw new ValidationError({ contactId: ['not_found'] });
  }
  if (dealId) {
    const [d] = await tx
      .select({ id: deals.id })
      .from(deals)
      .where(and(eq(deals.id, dealId), isNull(deals.deletedAt)))
      .limit(1);
    if (!d) throw new ValidationError({ dealId: ['not_found'] });
  }
}

async function loadLive(tx: Tx, id: string): Promise<Task> {
  const [row] = await tx
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .for('update')
    .limit(1);
  if (!row) throw new TaskNotFoundError();
  return row;
}

const link = (t: Pick<Task, 'contactId' | 'dealId'>) => ({
  contactId: t.contactId,
  dealId: t.dealId
});

export async function createTask(
  ctx: TenantContextInput,
  input: CreateTaskInput,
  opts: TaskOpts = {}
): Promise<Task> {
  const v = parseInput(createTaskSchema, input);
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    await assertAssignee(tx, v.assigneeId);
    await assertLinks(tx, v.contactId, v.dealId);
    const [row] = await tx
      .insert(tasks)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        title: v.title,
        dueAt: v.dueAt ?? null,
        // A task nobody picked is the creator's own follow-up.
        assigneeId: v.assigneeId === undefined ? (ctx.userId ?? null) : v.assigneeId,
        contactId: v.contactId ?? null,
        dealId: v.dealId ?? null,
        priority: v.priority,
        createdBy: ctx.userId ?? null
      })
      .returning();
    await recordActivity(tx, {
      ...link(row),
      type: 'task',
      refTable: 'tasks',
      refId: row.id,
      summary: `Task added: ${row.title}`,
      actor: actorOf(ctx)
    });
    await audit(tx, {
      action: 'task.create',
      entity: 'task',
      entityId: row.id,
      after: { dueAt: row.dueAt, assigneeId: row.assigneeId, priority: row.priority }
    });
    await scheduleTaskDue(tx, row);
    return row;
  });
}

export async function getTask(
  ctx: TenantContextInput,
  id: string,
  opts: TaskOpts = {}
): Promise<Task> {
  parseInput(uuidSchema, id);
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    const [row] = await tx
      .select()
      .from(tasks)
      .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
      .limit(1);
    if (!row) throw new TaskNotFoundError();
    return row;
  });
}

export async function updateTask(
  ctx: TenantContextInput,
  id: string,
  patch: UpdateTaskInput,
  opts: TaskOpts = {}
): Promise<Task> {
  parseInput(uuidSchema, id);
  const v = parseInput(updateTaskSchema, patch);
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    const before = await loadLive(tx, id);
    if (v.assigneeId !== undefined) await assertAssignee(tx, v.assigneeId);
    await assertLinks(tx, v.contactId, v.dealId);
    const [after] = await tx
      .update(tasks)
      .set({ ...v, updatedAt: now() })
      .where(eq(tasks.id, id))
      .returning();
    const changed = (Object.keys(v) as (keyof typeof v)[]).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
    if (changed.length) {
      await audit(tx, {
        action: 'task.update',
        entity: 'task',
        entityId: id,
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, after[k]]))
      });
    }
    if (changed.includes('dueAt')) await scheduleTaskDue(tx, after);
    return after;
  });
}

/** Marks the task done. A second call on a done task changes nothing (a double tap is safe). */
export async function completeTask(
  ctx: TenantContextInput,
  id: string,
  opts: TaskOpts = {}
): Promise<Task> {
  parseInput(uuidSchema, id);
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    const before = await loadLive(tx, id);
    if (before.completedAt) return before;
    const [after] = await tx
      .update(tasks)
      .set({ completedAt: now(), completedBy: ctx.userId ?? null, updatedAt: now() })
      .where(eq(tasks.id, id))
      .returning();
    await recordActivity(tx, {
      ...link(after),
      type: 'task',
      refTable: 'tasks',
      refId: id,
      summary: `Task completed: ${after.title}`,
      actor: actorOf(ctx)
    });
    await audit(tx, { action: 'task.complete', entity: 'task', entityId: id });
    await emitEvent(tx, {
      name: 'task.completed',
      tenantId: after.tenantId,
      actor: actorOf(ctx),
      payload: { taskId: id, contactId: after.contactId, dealId: after.dealId }
    });
    return after;
  });
}

/** Undo for completeTask (DESIGN_SYSTEM Toast). The timeline keeps both entries. */
export async function reopenTask(
  ctx: TenantContextInput,
  id: string,
  opts: TaskOpts = {}
): Promise<Task> {
  parseInput(uuidSchema, id);
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    const before = await loadLive(tx, id);
    if (!before.completedAt) return before;
    const [after] = await tx
      .update(tasks)
      .set({ completedAt: null, completedBy: null, updatedAt: now() })
      .where(eq(tasks.id, id))
      .returning();
    await recordActivity(tx, {
      ...link(after),
      type: 'task',
      refTable: 'tasks',
      refId: id,
      summary: `Task reopened: ${after.title}`,
      actor: actorOf(ctx)
    });
    await audit(tx, { action: 'task.reopen', entity: 'task', entityId: id });
    return after;
  });
}

/** Soft delete; the row stays so the timeline entries keep their reference. */
export async function deleteTask(
  ctx: TenantContextInput,
  id: string,
  opts: TaskOpts = {}
): Promise<void> {
  parseInput(uuidSchema, id);
  await run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    await loadLive(tx, id);
    await tx.update(tasks).set({ deletedAt: now(), updatedAt: now() }).where(eq(tasks.id, id));
    await audit(tx, { action: 'task.delete', entity: 'task', entityId: id });
  });
}

export async function restoreTask(
  ctx: TenantContextInput,
  id: string,
  opts: TaskOpts = {}
): Promise<Task> {
  parseInput(uuidSchema, id);
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    const [row] = await tx.select().from(tasks).where(eq(tasks.id, id)).for('update').limit(1);
    if (!row || !row.deletedAt) throw new TaskNotFoundError();
    const [after] = await tx
      .update(tasks)
      .set({ deletedAt: null, updatedAt: now() })
      .where(eq(tasks.id, id))
      .returning();
    await audit(tx, { action: 'task.restore', entity: 'task', entityId: id });
    return after;
  });
}

type Joined = { task: Task; contactName: string | null; assigneeName: string | null };

const toRow = ({ task, contactName, assigneeName }: Joined): TaskRow => ({
  ...task,
  contactName,
  assigneeName
});

const contactLabel = sql<
  string | null
>`nullif(btrim(concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})), '')`;
const assigneeLabel = sql<string | null>`coalesce(${users.name}, ${users.email})`;

function selectRows(tx: Tx) {
  return tx
    .select({ task: tasks, contactName: contactLabel, assigneeName: assigneeLabel })
    .from(tasks)
    .leftJoin(
      contacts,
      and(eq(contacts.id, tasks.contactId), eq(contacts.tenantId, tasks.tenantId))
    )
    .leftJoin(users, eq(users.id, tasks.assigneeId));
}

/**
 * Splits open tasks by the tenant's calendar day (F-20). Overdue is anything past due right now,
 * including earlier today; Today runs to the end of the tenant's day; Upcoming is later days, then
 * tasks with no due date. Pure so the boundaries are unit-tested.
 */
export function groupTasks(rows: TaskRow[], at: Date, tomorrowStart: Date): MyTasks {
  const out: MyTasks = { overdue: [], today: [], upcoming: [] };
  const due = (t: TaskRow) => (t.dueAt ? new Date(t.dueAt).getTime() : Number.POSITIVE_INFINITY);
  for (const t of rows.toSorted((a, b) => due(a) - due(b))) {
    const d = due(t);
    if (d < at.getTime()) out.overdue.push(t);
    else if (d < tomorrowStart.getTime()) out.today.push(t);
    else out.upcoming.push(t);
  }
  return out;
}

/** My Tasks (F-20): open tasks grouped Overdue, Today, Upcoming. `now` is for tests. */
export async function listMyTasks(
  ctx: TenantContextInput,
  input: ListMyTasksInput = {},
  opts: TaskOpts & { now?: Date } = {}
): Promise<MyTasks> {
  const { scope } = parseInput(listMyTasksSchema, input);
  const at = opts.now ?? new Date();
  const me = ctx.userId;
  if (scope === 'mine' && !me) throw new AppError('FORBIDDEN');
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    const [tenant] = await tx
      .select({
        timezone: tenants.timezone,
        tomorrow: sql<string>`(date_trunc('day', ${at.toISOString()}::timestamptz at time zone ${tenants.timezone}) + interval '1 day') at time zone ${tenants.timezone}`
      })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .limit(1);
    if (!tenant) throw new TaskNotFoundError();
    const rows = await selectRows(tx)
      .where(
        and(
          isNull(tasks.completedAt),
          isNull(tasks.deletedAt),
          scope === 'mine' && me ? eq(tasks.assigneeId, me) : undefined
        )
      )
      .orderBy(asc(tasks.dueAt), asc(tasks.createdAt));
    return groupTasks(rows.map(toRow), at, new Date(tenant.tomorrow));
  });
}

/** A contact's or deal's tasks: open ones by due date, then the latest completed. */
export async function listEntityTasks(
  ctx: TenantContextInput,
  input: ListEntityTasksInput,
  opts: TaskOpts = {}
): Promise<{ open: TaskRow[]; completed: TaskRow[] }> {
  const v = parseInput(listEntityTasksSchema, input);
  const onEntity = v.contactId ? eq(tasks.contactId, v.contactId) : eq(tasks.dealId, v.dealId!);
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    const open = await selectRows(tx)
      .where(and(onEntity, isNull(tasks.completedAt), isNull(tasks.deletedAt)))
      .orderBy(sql`${tasks.dueAt} asc nulls last`, asc(tasks.createdAt));
    const completed = v.completedLimit
      ? await selectRows(tx)
          .where(and(onEntity, isNotNull(tasks.completedAt), isNull(tasks.deletedAt)))
          .orderBy(desc(tasks.completedAt))
          .limit(v.completedLimit)
      : [];
    return { open: open.map(toRow), completed: completed.map(toRow) };
  });
}

export type Assignee = { id: string; name: string };

/** People a task can be assigned to: the tenant's members. */
export async function listAssignees(
  ctx: TenantContextInput,
  opts: TaskOpts = {}
): Promise<Assignee[]> {
  return run(ctx, opts, async (tx) => {
    await requireCrmLite(tx);
    const rows = await tx
      .select({ id: users.id, name: assigneeLabel })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .orderBy(asc(users.name), asc(users.email));
    return rows.map((r) => ({ id: r.id, name: r.name ?? 'Team member' }));
  });
}

export async function getTenantTimezone(
  ctx: TenantContextInput,
  opts: TaskOpts = {}
): Promise<string> {
  return run(ctx, opts, async (tx) => {
    const [t] = await tx
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, sql`app_tenant_id()`))
      .limit(1);
    if (!t) throw new TaskNotFoundError();
    return t.timezone;
  });
}
