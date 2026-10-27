'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { AppError } from '@/server/errors';
import {
  createFieldDef,
  customFieldsScope,
  deleteFieldDef,
  reorderFieldDefs,
  updateFieldDef,
  type CreateFieldDefInput,
  type CustomFieldEntity,
  type UpdateFieldDefInput
} from '@/server/custom-fields';
import { ModuleDisabledError } from '@/server/modules';

export type ActionResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: Record<string, string[]> };

// Server actions for the custom fields settings page (M1-06, F-12). Each one rebuilds the tenant
// context from the session, then calls the service, which re-checks CRM Full and the owner or admin
// role. Nothing the browser sends is trusted for tenant or role.

async function guarded(
  fn: (ctx: NonNullable<Awaited<ReturnType<typeof customFieldsScope>>>['ctx']) => Promise<void>
): Promise<ActionResult> {
  try {
    const scope = await customFieldsScope(await headers());
    if (!scope || !scope.canEdit) return { ok: false, message: 'You do not have access to this.' };
    await fn(scope.ctx);
    revalidatePath('/dashboard/settings/custom-fields');
    revalidatePath('/dashboard/contacts');
    return { ok: true };
  } catch (err) {
    if (err instanceof ModuleDisabledError) {
      return { ok: false, message: 'Custom fields are not enabled for your account.' };
    }
    if (err instanceof AppError) {
      return { ok: false, message: err.message, fieldErrors: err.fieldErrors };
    }
    console.error('Custom field action failed', err);
    return { ok: false, message: 'Something went wrong on our side.' };
  }
}

export async function createFieldAction(input: CreateFieldDefInput): Promise<ActionResult> {
  return guarded(async (ctx) => void (await createFieldDef(ctx, input)));
}

export async function updateFieldAction(
  id: string,
  patch: UpdateFieldDefInput
): Promise<ActionResult> {
  return guarded(async (ctx) => void (await updateFieldDef(ctx, id, patch)));
}

export async function deleteFieldAction(id: string): Promise<ActionResult> {
  return guarded((ctx) => deleteFieldDef(ctx, id));
}

export async function reorderFieldsAction(
  entity: CustomFieldEntity,
  ids: string[]
): Promise<ActionResult> {
  return guarded(async (ctx) => void (await reorderFieldDefs(ctx, { entity, ids })));
}
