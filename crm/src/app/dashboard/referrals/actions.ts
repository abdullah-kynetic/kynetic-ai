'use server';

import { AppError, errorBody, toErrorResult, type ErrorBody } from '@/server/errors';
import { ModuleDisabledError } from '@/server/modules';
import {
  createReferral,
  updateReferral,
  type CreateReferralInput,
  type UpdateReferralInput
} from '@/server/referrals';
import { loadShellContext } from '@/server/shell';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';

export type ReferralActionResult = { ok: true } | ErrorBody;

async function context() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) throw new AppError('UNAUTHENTICATED');
  if (!shell.tenant) throw new AppError('FORBIDDEN');
  return { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
}

function guarded(fn: () => Promise<void>): Promise<ReferralActionResult> {
  return fn()
    .then(() => {
      revalidatePath('/dashboard/referrals');
      return { ok: true as const };
    })
    .catch((err) => {
      if (err instanceof ModuleDisabledError) return errorBody('MODULE_DISABLED');
      return toErrorResult(err).body;
    });
}

export async function createReferralAction(
  input: CreateReferralInput
): Promise<ReferralActionResult> {
  return guarded(async () => {
    await createReferral(await context(), input);
  });
}

export async function updateReferralAction(
  id: string,
  input: UpdateReferralInput
): Promise<ReferralActionResult> {
  return guarded(async () => {
    await updateReferral(await context(), id, input);
  });
}
