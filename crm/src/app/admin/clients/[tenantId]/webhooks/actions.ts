'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { rotateLeadWebhookSecret, setN8nPushConfig } from '@/server/admin/lead-webhooks';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';

export async function rotateLeadWebhookAction(
  tenantId: string
): Promise<{ ok: true; secret: string } | { ok: false; message: string }> {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin')
    return { ok: false, message: 'Only a Kynetic admin can manage webhook secrets.' };
  if (await isViewingAs(access.user))
    return { ok: false, message: 'Exit view-as before managing webhook secrets.' };
  try {
    const result = await rotateLeadWebhookSecret(
      { id: access.user.id, kyneticRole: access.role },
      tenantId
    );
    revalidatePath(`/admin/clients/${tenantId}/webhooks`);
    return { ok: true, secret: result.secret };
  } catch {
    // Never serialize encryption or database errors from a secret-bearing operation.
    return { ok: false, message: 'The signing secret could not be changed. Try again.' };
  }
}

export async function saveN8nPushAction(tenantId: string, form: FormData) {
  const access = await decideAdminAccess(await headers());
  const back = `/admin/clients/${tenantId}/webhooks`;
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    redirect(`${back}?n8n=forbidden`);
  try {
    await setN8nPushConfig({ id: access.user.id, kyneticRole: access.role }, tenantId, {
      url: String(form.get('url') ?? ''),
      secret: String(form.get('secret') ?? '')
    });
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION_FAILED')
      redirect(`${back}?n8n=invalid`);
    redirect(`${back}?n8n=failed`);
  }
  revalidatePath(back);
  redirect(`${back}?n8n=saved`);
}
