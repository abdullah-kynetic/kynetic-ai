import { getSessionUser } from '@/server/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

// Kynetic staff go to the admin side; clients (and anyone signed out) go through /dashboard.
export default async function Page() {
  const user = await getSessionUser(await headers());
  redirect(user?.kyneticRole ? '/admin' : '/dashboard');
}
