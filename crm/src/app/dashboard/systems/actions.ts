'use server';

import { contactsActorScope } from '@/server/contacts';
import { AppError } from '@/server/errors';
import { requestSystem } from '@/server/systems/requests';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function requestSystemAction(form: FormData) {
  const scope = await contactsActorScope(await headers(), 'tenant_data.write');
  if (!scope) redirect('/sign-in');
  const moduleKey = String(form.get('moduleKey') ?? '');
  try {
    await requestSystem(scope.ctx, scope.actor, { moduleKey });
  } catch (error) {
    if (error instanceof AppError)
      redirect(`/dashboard/systems?error=${error.code === 'CONFLICT' ? 'on' : 'invalid'}`);
    throw error;
  }
  revalidatePath('/dashboard/systems');
  revalidatePath('/admin/system-requests');
  redirect('/dashboard/systems?requested=1');
}
