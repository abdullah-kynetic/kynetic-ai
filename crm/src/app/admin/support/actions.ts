'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { setSupportRequestStatus } from '@/server/support';
import { isViewingAs } from '../view-as-guard';

export async function setSupportStatusAction(form: FormData) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  await setSupportRequestStatus(
    { userId: access.user.id, role: access.role },
    String(form.get('id') ?? ''),
    String(form.get('status') ?? '')
  );
  revalidatePath('/admin/support');
}
