'use server';
import { revalidatePath } from 'next/cache';
import { logAgencyDm } from '@/server/agency/inbox';
import { agencyCaller } from '../caller';
export async function logDmAction(form: FormData) {
  await logAgencyDm(await agencyCaller(), {
    contactId: String(form.get('contactId') ?? ''),
    direction: String(form.get('direction') ?? ''),
    platform: String(form.get('platform') ?? ''),
    body: String(form.get('body') ?? '')
  });
  revalidatePath('/admin/agency/inbox');
  revalidatePath('/admin/agency');
}
