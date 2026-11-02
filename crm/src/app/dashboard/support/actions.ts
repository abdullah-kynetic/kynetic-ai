'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contactsActorScope } from '@/server/contacts';
import { AppError } from '@/server/errors';
import { submitSupportRequest } from '@/server/support';

export async function submitSupportRequestAction(form: FormData) {
  const scope = await contactsActorScope(await headers());
  if (!scope) redirect('/sign-in');
  let failed = false;
  try {
    await submitSupportRequest(scope.ctx, scope.actor, {
      subject: String(form.get('subject') ?? ''),
      body: String(form.get('body') ?? '')
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    failed = true;
  }
  revalidatePath('/dashboard/support');
  redirect(failed ? '/dashboard/support?error=invalid' : '/dashboard/support?sent=1');
}
