'use server';

import {
  markGoLive,
  regenerateChecklist,
  STEP_STATUSES,
  updateChecklistStep,
  type StepStatus
} from '@/server/admin';
import { authorize, ForbiddenError, requireUser, resolveActor } from '@/server/auth';
import { AppError } from '@/server/errors';
import { refuseDuringViewAs } from '../../../view-as-guard';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';

export type ChecklistState = { status: 'idle' | 'saved' } | { status: 'error'; message: string };

/**
 * The signed-in Kynetic user, checked against the matrix on this request (SECURITY 2.2). Admin and VA
 * both work the checklist (SECURITY F-100); the roll-up functions check the role again. `go_live` is
 * admin only, so it asks for `admin.onboard`.
 */
async function staffCtx(action: 'admin.clients.read' | 'admin.onboard') {
  const user = await requireUser(await headers());
  await refuseDuringViewAs(user);
  const actor = await resolveActor(user);
  authorize(actor, action);
  return { userId: user.id, role: actor.kyneticRole! };
}

function failure(err: unknown): ChecklistState {
  if (err instanceof AppError) return { status: 'error', message: err.message };
  if (err instanceof ForbiddenError)
    return { status: 'error', message: 'You do not have access to this.' };
  console.error('Checklist action failed', err instanceof Error ? err.name : 'unknown');
  return {
    status: 'error',
    message: 'Something went wrong. Nothing was changed. Try again.'
  };
}

const text = (f: FormData, k: string) => String(f.get(k) ?? '').trim();

export async function saveStep(_prev: ChecklistState, form: FormData): Promise<ChecklistState> {
  try {
    const ctx = await staffCtx('admin.clients.read');
    const tenantId = text(form, 'tenantId');
    const status = text(form, 'status') as StepStatus;
    const assign = text(form, 'assign');
    if (!STEP_STATUSES.includes(status)) return { status: 'error', message: 'Pick a status.' };
    await updateChecklistStep(ctx, tenantId, text(form, 'stepKey'), {
      status,
      ownerUserId: assign === 'me' ? ctx.userId : assign === 'none' ? null : undefined,
      dueDate: text(form, 'dueDate') || null,
      note: text(form, 'note') || null
    });
    revalidatePath(`/admin/clients/${tenantId}/checklist`);
    return { status: 'saved' };
  } catch (err) {
    return failure(err);
  }
}

export async function goLive(_prev: ChecklistState, form: FormData): Promise<ChecklistState> {
  try {
    const ctx = await staffCtx('admin.onboard');
    const tenantId = text(form, 'tenantId');
    await markGoLive(ctx, tenantId);
    revalidatePath(`/admin/clients/${tenantId}/checklist`);
    return { status: 'saved' };
  } catch (err) {
    return failure(err);
  }
}

export async function regenerate(_prev: ChecklistState, form: FormData): Promise<ChecklistState> {
  try {
    const ctx = await staffCtx('admin.onboard');
    const tenantId = text(form, 'tenantId');
    await regenerateChecklist(ctx, tenantId);
    revalidatePath(`/admin/clients/${tenantId}/checklist`);
    return { status: 'saved' };
  } catch (err) {
    return failure(err);
  }
}
