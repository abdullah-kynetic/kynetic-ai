'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { saveAgencyMessage, previewAgencyMessage } from '@/server/agency/messaging';
import { AppError } from '@/server/errors';
import { agencyCaller } from '../caller';
export async function saveMessageAction(form: FormData) {
  const row = await saveAgencyMessage(await agencyCaller(), {
    contactId: String(form.get('contactId') ?? ''),
    channel: String(form.get('channel') ?? ''),
    subject: String(form.get('subject') ?? ''),
    body: String(form.get('body') ?? '')
  });
  revalidatePath('/admin/agency/compose');
  redirect(`/admin/agency/compose?saved=${row.id}`);
}
export async function previewMessageAction(id: string) {
  try {
    await previewAgencyMessage(await agencyCaller(), id);
  } catch (error) {
    if (error instanceof AppError)
      redirect(`/admin/agency/compose?error=${error.code === 'FORBIDDEN' ? 'blocked' : 'check'}`);
    throw error;
  }
  revalidatePath('/admin/agency/compose');
}
