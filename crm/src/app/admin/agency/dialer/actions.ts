'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { forbidden, redirect } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { logAgencyCall, markAgencyDnc } from '@/server/agency/dialer';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../view-as-guard';
async function caller() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  return { id: access.user.id, kyneticRole: access.role };
}
export async function logAgencyCallAction(contactId: string, form: FormData) {
  const actor = await caller();
  let invalid = false;
  try {
    const callbackDate = String(form.get('callbackDate') ?? '');
    const callbackTime = String(form.get('callbackTime') ?? '');
    await logAgencyCall(actor, {
      contactId,
      eventId: String(form.get('eventId') ?? ''),
      outcome: String(form.get('outcome') ?? ''),
      notes: String(form.get('notes') ?? ''),
      ...(callbackDate ? { callbackDate } : {}),
      ...(callbackTime ? { callbackTime } : {})
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    if (error.fieldErrors?.callbackDate) {
      revalidatePath('/admin/agency/dialer');
      redirect('/admin/agency/dialer?error=callback');
    }
    invalid = true;
  }
  revalidatePath('/admin/agency/dialer');
  revalidatePath('/admin/agency/campaigns');
  if (invalid) redirect('/admin/agency/dialer?error=unavailable');
}
export async function markAgencyDncAction(contactId: string) {
  await markAgencyDnc(await caller(), contactId);
  revalidatePath('/admin/agency/dialer');
}
