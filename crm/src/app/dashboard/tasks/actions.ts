'use server';

import {
  AppError,
  errorBody,
  toErrorResult,
  ValidationError,
  type ErrorBody
} from '@/server/errors';
import { ModuleDisabledError } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import {
  completeTask,
  createTask,
  deleteTask,
  getTenantTimezone,
  localToInstant,
  reopenTask,
  restoreTask,
  updateTask,
  type TaskPriority
} from '@/server/tasks';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

// Server actions for tasks (M3-02; PRD F-20). Order per CODE_STYLE: authenticate, tenant context
// (withTenant inside the service), module check, validate, write, audit. The tenant comes from the
// session, never from the form.

export type TaskActionResult = { ok: true } | ErrorBody;

export type SaveTaskInput = {
  id?: string;
  title: string;
  /** `YYYY-MM-DDTHH:mm` in the tenant's time zone, or empty for no due date. */
  dueLocal: string;
  priority: TaskPriority;
  /** Empty string = unassigned. */
  assigneeId: string;
  contactId?: string;
  dealId?: string;
};

async function context() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) throw new AppError('UNAUTHENTICATED');
  if (!shell.tenant) throw new AppError('FORBIDDEN');
  return { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
}

async function guarded(fn: () => Promise<void>): Promise<TaskActionResult> {
  try {
    await fn();
    revalidatePath('/dashboard', 'layout');
    return { ok: true };
  } catch (err) {
    if (err instanceof ModuleDisabledError) return errorBody('MODULE_DISABLED');
    return toErrorResult(err).body;
  }
}

export async function saveTaskAction(input: SaveTaskInput): Promise<TaskActionResult> {
  return guarded(async () => {
    const ctx = await context();
    let dueAt: string | null = null;
    if (input.dueLocal) {
      const instant = localToInstant(input.dueLocal, await getTenantTimezone(ctx));
      if (!instant) throw new ValidationError({ dueAt: ['invalid_date'] });
      dueAt = instant.toISOString();
    }
    const fields = {
      title: input.title,
      dueAt,
      priority: input.priority,
      assigneeId: input.assigneeId || null
    };
    if (input.id) await updateTask(ctx, input.id, fields);
    else {
      await createTask(ctx, {
        ...fields,
        contactId: input.contactId || null,
        dealId: input.dealId || null
      });
    }
  });
}

export async function completeTaskAction(id: string): Promise<TaskActionResult> {
  return guarded(async () => void (await completeTask(await context(), id)));
}

/** The undo behind the "Task completed" toast. */
export async function reopenTaskAction(id: string): Promise<TaskActionResult> {
  return guarded(async () => void (await reopenTask(await context(), id)));
}

export async function deleteTaskAction(id: string): Promise<TaskActionResult> {
  return guarded(async () => deleteTask(await context(), id));
}

/** The undo behind the "Task deleted" toast. */
export async function restoreTaskAction(id: string): Promise<TaskActionResult> {
  return guarded(async () => void (await restoreTask(await context(), id)));
}
