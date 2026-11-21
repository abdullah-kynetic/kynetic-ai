import { and, eq, isNull } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { tasks } from '../db/schema';
import { AppError } from '../errors';
import { completeTask, deleteTask, reopenTask, restoreTask } from '../tasks/service';
import type { ServiceContext } from '../service-auth/authenticate';
import { uuidSchema } from '../validation';
import { parseInput } from '../validation';

// Task lifecycle for the service API (C5): complete, reopen, delete and restore. Each is one call to the
// same task function the portal uses, tagged origin 'service-api', so it queues no due reminder and no
// n8n push. Tasks of another tenant are a 404 because RLS hides them.

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });
const origin = { origin: 'service-api' as const };

async function liveTaskDto(tx: Tx, id: string) {
  const [r] = await tx
    .select({
      id: tasks.id,
      title: tasks.title,
      dueAt: tasks.dueAt,
      priority: tasks.priority,
      completedAt: tasks.completedAt,
      updatedAt: tasks.updatedAt
    })
    .from(tasks)
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .limit(1);
  if (!r) throw new AppError('NOT_FOUND');
  return { ...r, status: r.completedAt ? 'done' : 'open' };
}

/** Runs inside withServiceTenant. Completing a task that is already done changes nothing. */
export async function completeServiceTask(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  await completeTask(sysCtx(svc), id, { tx, ...origin });
  return liveTaskDto(tx, id);
}

/** Runs inside withServiceTenant. */
export async function reopenServiceTask(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  await reopenTask(sysCtx(svc), id, { tx, ...origin });
  return liveTaskDto(tx, id);
}

/** Runs inside withServiceTenant. Soft delete; the task can be restored. */
export async function deleteServiceTask(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  await liveTaskDto(tx, id);
  await deleteTask(sysCtx(svc), id, { tx, ...origin });
  return { id, deleted: true as const };
}

/** Runs inside withServiceTenant. */
export async function restoreServiceTask(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  await restoreTask(sysCtx(svc), id, { tx, ...origin });
  return liveTaskDto(tx, id);
}
