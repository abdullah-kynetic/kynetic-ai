'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { setClientEmailFlags } from '@/server/admin';
import { setReportDay } from '@/server/admin/report-schedule';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';

export async function saveReportDayAction(tenantId: string, form: FormData) {
  const access = await decideAdminAccess(await headers());
  const back = `/admin/clients/${tenantId}/reports`;
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    redirect(`${back}?error=forbidden`);
  try {
    await setReportDay(
      { id: access.user.id, kyneticRole: access.role },
      tenantId,
      Number(form.get('day'))
    );
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION_FAILED')
      redirect(`${back}?error=invalid`);
    redirect(`${back}?error=failed`);
  }
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

export async function saveClientEmailAction(tenantId: string, form: FormData) {
  const access = await decideAdminAccess(await headers());
  const back = `/admin/clients/${tenantId}/reports`;
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    redirect(`${back}?error=forbidden`);
  try {
    await setClientEmailFlags({ userId: access.user.id, role: 'admin' }, tenantId, {
      weekly: form.get('weekly') === 'on',
      report: form.get('report') === 'on'
    });
  } catch {
    redirect(`${back}?error=failed`);
  }
  revalidatePath(back);
  redirect(`${back}?saved=email`);
}
