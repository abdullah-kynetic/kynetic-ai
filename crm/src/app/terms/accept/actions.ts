'use server';

import { getSessionUser } from '@/server/auth';
import { clientIp, recordAcceptance } from '@/server/terms';
import { safeNextPath } from '@/server/terms/gate';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export async function acceptTermsAction(form: FormData) {
  const requestHeaders = await headers();
  const user = await getSessionUser(requestHeaders);
  if (!user) redirect('/sign-in');
  const next = safeNextPath(String(form.get('next') ?? ''));
  await recordAcceptance(user.id, clientIp(requestHeaders.get('x-forwarded-for')), {
    userAgent: requestHeaders.get('user-agent')
  });
  redirect(next);
}
