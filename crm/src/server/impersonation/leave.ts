import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSessionUser } from '../auth';
import { getEnv } from '../env';
import { safeAdminReturn } from '@/lib/workspaces';
import { endViewAs, resolveViewAs } from './service';
import { VIEW_AS_COOKIE, VIEW_AS_RETURN_COOKIE } from './evaluate';

/**
 * Shared by `/view-as/exit` and `/view-as/expired`: closes the caller's session if it is closed or
 * due to close (writing the audit row), clears both cookies and sends the admin back to the admin
 * page the session was started from. Anyone who is not Kynetic staff just lands on the dashboard.
 */
export async function leaveViewAs(requestHeaders: Headers, mode: 'exit' | 'expired') {
  const store = await cookies();
  const cookie = store.get(VIEW_AS_COOKIE)?.value;
  const back = safeAdminReturn(store.get(VIEW_AS_RETURN_COOKIE)?.value);
  const base = getEnv().APP_BASE_URL;
  const user = await getSessionUser(requestHeaders);
  const staff = Boolean(user?.kyneticRole);
  if (user?.kyneticRole && cookie) {
    if (mode === 'exit') await endViewAs({ user, cookie });
    else {
      // `resolveViewAs` ends and audits the session when its 30 minutes are up.
      const state = await resolveViewAs({ user, cookie, touch: false });
      if (state.kind === 'active') return NextResponse.redirect(new URL('/dashboard', base), 303);
    }
  }
  store.delete(VIEW_AS_COOKIE);
  store.delete(VIEW_AS_RETURN_COOKIE);
  return NextResponse.redirect(new URL(staff ? back : '/dashboard', base), 303);
}
