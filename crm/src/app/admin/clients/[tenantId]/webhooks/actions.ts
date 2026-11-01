'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { decideAdminAccess } from '@/server/admin';
import { rotateLeadWebhookSecret } from '@/server/admin/lead-webhooks';
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
