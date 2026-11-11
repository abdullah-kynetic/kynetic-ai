'use server';

import { AppError, errorBody, toErrorResult, type ErrorBody } from '@/server/errors';
import { ModuleDisabledError } from '@/server/modules';
import { requestReview, type RequestReviewInput } from '@/server/reviews';
import { loadShellContext } from '@/server/shell';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';

export type ReviewActionResult = { ok: true } | ErrorBody;

async function context() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) throw new AppError('UNAUTHENTICATED');
  if (!shell.tenant) throw new AppError('FORBIDDEN');
  return { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
}

/** Queue a review request. The service checks OPM, the contact and canContact; nothing is sent. */
export async function requestReviewAction(input: RequestReviewInput): Promise<ReviewActionResult> {
  try {
    await requestReview(await context(), input);
    revalidatePath('/dashboard/reviews');
    return { ok: true };
  } catch (err) {
    if (err instanceof ModuleDisabledError) return errorBody('MODULE_DISABLED');
    return toErrorResult(err).body;
  }
}
