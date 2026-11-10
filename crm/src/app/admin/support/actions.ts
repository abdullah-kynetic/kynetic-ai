'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { replyAsStaff, setSupportRequestStatus, type SupportCategory } from '@/server/support';
import { isViewingAs } from '../view-as-guard';

async function staff() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  return { userId: access.user.id, role: access.role };
}

export async function setSupportStatusAction(form: FormData) {
  const ctx = await staff();
  const id = String(form.get('id') ?? '');
  await setSupportRequestStatus(ctx, id, String(form.get('status') ?? ''));
  revalidatePath('/admin/support');
  revalidatePath(`/admin/support/${id}`);
}

export async function replyToSupportAction(requestId: string, form: FormData) {
  const ctx = await staff();
  await replyAsStaff(ctx, requestId, String(form.get('body') ?? ''));
  revalidatePath('/admin/support');
  revalidatePath(`/admin/support/${requestId}`);
}

export type { SupportCategory };
