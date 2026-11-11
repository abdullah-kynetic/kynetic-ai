'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { contactsActorScope } from '@/server/contacts';
import { AppError } from '@/server/errors';
import { replyToOwnSupportRequest, submitSupportRequest } from '@/server/support';

export async function submitSupportRequestAction(form: FormData) {
  const scope = await contactsActorScope(await headers(), 'tenant_data.write');
  if (!scope) redirect('/sign-in');
  let failed = false;
  let id = '';
  try {
    const created = await submitSupportRequest(scope.ctx, scope.actor, {
      subject: String(form.get('subject') ?? ''),
      body: String(form.get('body') ?? ''),
      category: String(form.get('category') ?? 'general')
    });
    id = created.id;
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    failed = true;
  }
  revalidatePath('/dashboard/support');
  redirect(failed || !id ? '/dashboard/support?error=invalid' : `/dashboard/support/${id}`);
}

export async function replyToSupportAction(requestId: string, form: FormData) {
  const scope = await contactsActorScope(await headers(), 'tenant_data.write');
  if (!scope) redirect('/sign-in');
  let failed = false;
  try {
    await replyToOwnSupportRequest(
      scope.ctx,
      scope.actor,
      requestId,
      String(form.get('body') ?? '')
    );
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    failed = true;
  }
  revalidatePath(`/dashboard/support/${requestId}`);
  redirect(
    failed ? `/dashboard/support/${requestId}?error=invalid` : `/dashboard/support/${requestId}`
  );
}
