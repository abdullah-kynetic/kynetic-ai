'use server';

import { ForbiddenError, getSessionUser, SecondFactorRequiredError } from '@/server/auth';
import { AppError, ValidationError } from '@/server/errors';
import {
  disableWriteMode,
  enableWriteMode,
  endViewAs,
  startViewAs,
  VIEW_AS_COOKIE,
  type ViewAsUser
} from '@/server/impersonation';
import { clientIp } from '@/server/terms';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';

export type ViewAsActionResult = { error: string } | void;

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  // Browser-side cap only. The 30-minute idle expiry is enforced from the database row.
  maxAge: 8 * 60 * 60
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

/** Starts view-as for one tenant. Needs a reason. Origin is checked by Next for server actions. */
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
  redirect('/dashboard');
}

/** Ends the session, clears the cookie and goes back to the admin side. */
export async function exitViewAsAction(): Promise<void> {
  const { user } = await staffUser();
  const cookieStore = await cookies();
  await endViewAs({ user, cookie: cookieStore.get(VIEW_AS_COOKIE)?.value });
  cookieStore.delete(VIEW_AS_COOKIE);
  redirect('/admin');
}

/** Admin only: write mode for 30 minutes, with a second reason. */
export async function enableWriteModeAction(formData: FormData): Promise<ViewAsActionResult> {
  const { user } = await staffUser();
  const cookieStore = await cookies();
  try {
    await enableWriteMode({
      user,
      cookie: cookieStore.get(VIEW_AS_COOKIE)?.value,
      reason: formData.get('reason')
    });
  } catch (err) {
    return { error: message(err) };
  }
  redirect('/dashboard');
}

export async function disableWriteModeAction(): Promise<void> {
  const { user } = await staffUser();
  const cookieStore = await cookies();
  await disableWriteMode({ user, cookie: cookieStore.get(VIEW_AS_COOKIE)?.value });
  redirect('/dashboard');
}
