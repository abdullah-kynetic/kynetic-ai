'use server';

import { authorize, requireUser, resolveActor } from '@/server/auth';
import { moveDeal, parseDealForm, updateDeal, type DealFormInput } from '@/server/deals';
import { toErrorResult, type FieldErrors } from '@/server/errors';
import { loadShellContext } from '@/server/shell';
import { withTenant } from '@/server/tenancy';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';

export type SaveDealResult =
  | { ok: true }
  | { ok: false; message: string; fieldErrors?: FieldErrors };

/**
 * Saves the slide-out form: the deal's fields and, when the stage changed, the move, in one
 * transaction. Entering a Lost stage needs a reason (F-14); the service refuses without one, so a
 * failed save leaves the deal untouched.
 */
export async function saveDeal(id: string, raw: DealFormInput): Promise<SaveDealResult> {
  try {
    const [requestHeaders, cookieStore] = await Promise.all([headers(), cookies()]);
    const user = await requireUser(requestHeaders);
    const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
    if (!shell?.tenant) return { ok: false, message: 'Sign in to continue.' };
    const tenantId = shell.tenant.id;
    authorize(await resolveActor(user, tenantId), 'tenant_data.write', tenantId);

    const parsed = parseDealForm(raw);
    if (!parsed.ok) {
      return { ok: false, message: 'Some fields are not valid.', fieldErrors: parsed.fieldErrors };
    }
    const { patch, stageId, lostReason } = parsed.value;
    const ctx = { tenantId, userId: user.id, role: shell.role };
    await withTenant(ctx, async (tx) => {
      const deal = await updateDeal(ctx, id, patch, { tx });
      if (stageId !== deal.stageId) await moveDeal(ctx, id, { stageId, lostReason }, { tx });
    });
    revalidatePath(`/dashboard/deals/${id}`);
    revalidatePath('/dashboard/deals');
    return { ok: true };
  } catch (err) {
    const { body } = toErrorResult(err);
    return { ok: false, message: body.error.message, fieldErrors: body.error.fieldErrors };
  }
}
