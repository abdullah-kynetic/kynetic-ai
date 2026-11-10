'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';
import { decideAdminAccess, offboardTenant } from '@/server/admin';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';

export async function offboardTenantAction(tenantId: string, formData: FormData) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const back = `/admin/clients/${tenantId}/offboard`;
  try {
    await offboardTenant(
      { userId: access.user.id, role: 'admin' },
      tenantId,
      String(formData.get('slug') ?? '')
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION_FAILED')
      redirect(`${back}?error=slug`);
    if (error instanceof AppError && error.code === 'NOT_FOUND') redirect(`${back}?error=missing`);
    redirect(`${back}?error=failed`);
  }
  revalidatePath(back);
  revalidatePath(`/admin/clients/${tenantId}`);
  redirect(`${back}?done=1`);
}
