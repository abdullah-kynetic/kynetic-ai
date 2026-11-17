'use server';

import { ForbiddenError, getSessionUser, SecondFactorRequiredError } from '@/server/auth';
import { AppError, ValidationError } from '@/server/errors';
import {
  startViewAs,
  VIEW_AS_COOKIE,
  VIEW_AS_RETURN_COOKIE,
  type ViewAsUser
} from '@/server/impersonation';
import { clientIp } from '@/server/terms';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { safeAdminReturn } from '@/lib/workspaces';

export type ViewAsActionResult = { error: string } | void;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  // Browser-side cap. The hard 30-minute end is enforced from the database row.
  maxAge: 30 * 60
} as const;

function message(err: unknown): string {
  if (err instanceof ValidationError)
    return Object.values(err.fieldErrors ?? {}).flat()[0] ?? err.message;
  if (err instanceof AppError || err instanceof ForbiddenError) return err.message;
  if (err instanceof SecondFactorRequiredError) return 'Finish two-factor sign-in first.';
  throw err;
}

async function staffUser(): Promise<{ user: ViewAsUser; requestHeaders: Headers }> {
  const requestHeaders = await headers();
  const user = await getSessionUser(requestHeaders);
  if (!user) redirect('/sign-in');
  return { user, requestHeaders };
}

/**
 * Starts view-as for one tenant (read-only, ends 30 minutes after it starts). The admin role needs no
 * typed reason; a VA does. There is no write mode: Exit and expiry live in `/view-as/exit` and
 * `/view-as/expired`, and the proxy refuses every write while a session is open.
 */
export async function startViewAsAction(formData: FormData): Promise<ViewAsActionResult> {
  const { user, requestHeaders } = await staffUser();
  const tenantId = z.uuid().safeParse(formData.get('tenantId'));
  if (!tenantId.success) return { error: 'Pick a client.' };
  const cookieStore = await cookies();
  let value: string;
  try {
    ({ cookie: value } = await startViewAs({
      user,
      tenantId: tenantId.data,
      reason: formData.get('reason'),
      activeCookie: cookieStore.get(VIEW_AS_COOKIE)?.value,
      meta: {
        ip: clientIp(requestHeaders.get('x-forwarded-for')),
        userAgent: requestHeaders.get('user-agent')
      }
    }));
  } catch (err) {
    return { error: message(err) };
  }
  cookieStore.set(VIEW_AS_COOKIE, value, COOKIE_OPTIONS);
  cookieStore.set(VIEW_AS_RETURN_COOKIE, safeAdminReturn(formData.get('returnTo')), COOKIE_OPTIONS);
  redirect('/dashboard');
}
