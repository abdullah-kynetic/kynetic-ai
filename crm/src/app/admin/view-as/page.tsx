import PageContainer from '@/components/layout/page-container';
import { getSessionUser } from '@/server/auth';
import { listViewAsTenants } from '@/server/impersonation';
import { headers } from 'next/headers';
import { StartViewAsForm } from './start-form';

export const dynamic = 'force-dynamic';

// F-57. The admin layout has already checked the Kynetic role and TOTP; the list is staff-only again here.
export default async function ViewAsPage() {
  const user = await getSessionUser(await headers());
  const tenants = user ? await listViewAsTenants(user) : [];
  return (
    <PageContainer
      pageTitle='View as client'
      pageDescription='See the portal as a client sees it. Read-only unless an admin turns on write mode. Every session is logged; a VA also gives a reason.'
    >
      {tenants.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No clients yet.</p>
      ) : (
        <ul className='divide-y rounded-lg border'>
          {tenants.map((t) => (
            <li key={t.id} className='space-y-2 p-4'>
              <p className='font-medium'>
                {t.name}{' '}
                <span className='text-muted-foreground text-sm font-normal'>({t.status})</span>
              </p>
              <StartViewAsForm
                tenantId={t.id}
                tenantName={t.name}
                reasonRequired={user?.kyneticRole !== 'admin'}
              />
            </li>
          ))}
        </ul>
      )}
    </PageContainer>
  );
}
