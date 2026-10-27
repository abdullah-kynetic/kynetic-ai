import { ForbiddenError } from '@/server/auth';
import { resolveViewAs, VIEW_AS_COOKIE, type ViewAsUser } from '@/server/impersonation';
import { cookies } from 'next/headers';

/**
 * True when this request carries a live view-as session. Impersonation cannot change users, modules
 * or billing, or reach the rest of the admin side (SECURITY 2.6). The admin layout already redirects
 * pages, but a server action is a public endpoint, so every admin action asks again.
 */
export async function isViewingAs(user: ViewAsUser): Promise<boolean> {
  const cookie = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  return (await resolveViewAs({ user, cookie, touch: false })).kind === 'active';
}

/** Throws `ForbiddenError` during a view-as session. For actions that already map that error. */
export async function refuseDuringViewAs(user: ViewAsUser): Promise<void> {
  if (await isViewingAs(user))
    throw new ForbiddenError('Exit view-as before using the admin side.');
}
