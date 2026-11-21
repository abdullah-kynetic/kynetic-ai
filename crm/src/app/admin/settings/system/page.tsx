import Link from 'next/link';
import { headers } from 'next/headers';
import { decideAdminAccess } from '@/server/admin';
import { isAdminKeyOwner } from '@/server/admin/admin-api-keys';
import BackupsPage from '../../backups/page';

export const dynamic = 'force-dynamic';

export default async function SystemSettingsPage() {
  const access = await decideAdminAccess(await headers());
  // The link is shown only to the portal owner. The page itself re-checks and refuses everyone else.
  const owner =
    access.kind === 'ok' &&
    access.role === 'admin' &&
    (await isAdminKeyOwner({ id: access.user.id, kyneticRole: access.role }).catch(() => false));
  return (
    <>
      {owner && (
        <nav aria-label='Owner tools' className='px-4 pt-4 md:px-6'>
          <Link className='text-sm underline underline-offset-4' href='/admin/api-keys'>
            API keys and the stop-all switch
          </Link>
        </nav>
      )}
      <BackupsPage />
    </>
  );
}
