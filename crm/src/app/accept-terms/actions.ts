'use server';

import { getSessionUser } from '@/server/auth';
import { clientIp, recordAcceptance } from '@/server/terms';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/** Records acceptance for the signed-in user, then continues to the portal. */
export async function acceptTerms(formData: FormData): Promise<{ error: string } | void> {
  const requestHeaders = await headers();
  const user = await getSessionUser(requestHeaders);
  if (!user) redirect('/sign-in');
  if (formData.get('accept') !== 'on') {
    return { error: 'Tick the box to accept the Terms and Privacy Policy and continue.' };
  }
  await recordAcceptance(user.id, clientIp(requestHeaders.get('x-forwarded-for')));
  redirect('/dashboard');
}
