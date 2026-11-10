'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { decideAdminAccess, setMonthlySpendCap } from '@/server/admin';
import { isViewingAs } from '../../view-as-guard';

export async function saveSpendCapAction(formData: FormData) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const tenantId = String(formData.get('tenantId'));
  const raw = String(formData.get('cents') ?? '').trim();
  const cents = raw === '' ? null : Number(raw);
  await setMonthlySpendCap({ userId: access.user.id, role: 'admin' }, tenantId, cents);
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath('/admin/usage');
}
