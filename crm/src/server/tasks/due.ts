import { and, eq, isNull } from 'drizzle-orm';
import { getWorkerDb, type Db } from '../db/client';
import { tasks, notifications } from '../db/schema';
import { enqueue, registerWorker } from '../jobs';
import { notify } from '../notifications';
import { withTenant } from '../tenancy';

export type TaskDueJob = { tenantId: string; taskId: string };

/** Queue the reminder after the task's current due time. An old job safely no-ops after edits. */
export function scheduleTaskDue(
  tx: Parameters<Parameters<Db['transaction']>[0]>[0],
  task: Pick<typeof tasks.$inferSelect, 'id' | 'tenantId' | 'dueAt'>
): Promise<string | null> {
  if (!task.dueAt) return Promise.resolve(null);
  return enqueue('task.due', { tenantId: task.tenantId, taskId: task.id } satisfies TaskDueJob, {
    tx,
    startAfter: new Date(task.dueAt),
    singletonKey: `task-due:${task.id}:${task.dueAt}`
  });
}

export async function deliverTaskDue(job: TaskDueJob, opts: { db?: Db } = {}): Promise<boolean> {
  return withTenant(
    { tenantId: job.tenantId, role: 'system' },
    async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, job.taskId), isNull(tasks.completedAt), isNull(tasks.deletedAt)))
        .limit(1);
      if (!task?.dueAt || !task.assigneeId || new Date(task.dueAt).getTime() > Date.now()) {
        return false;
      }

      const link = `/dashboard/tasks?task=${task.id}`;
      const [existing] = await tx
        .select({ id: notifications.id })
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, task.assigneeId),
            eq(notifications.kind, 'task_due'),
            eq(notifications.link, link)
          )
        )
        .limit(1);
      if (existing) return false;

      await notify(tx, {
        userId: task.assigneeId,
        type: 'task_due',
        title: `Task due: ${task.title}`,
        body: 'This follow-up is due.',
        link
      });
      return true;
    },
    { db: opts.db ?? getWorkerDb() }
  );
}

export async function registerTaskDueWorker(): Promise<void> {
  await registerWorker<TaskDueJob>('task.due', async (job) => {
    await deliverTaskDue(job);
  });
}
