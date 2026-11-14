import PageContainer from '@/components/layout/page-container';
import { StatusBadge, type StatusTone } from '@/components/ui/badge';
import { listAdminTenantOverview } from '@/server/admin';
import { requireUser } from '@/server/auth';
import { DEMO_CLIENT_PROFILES } from '@/server/db/seed/demo-client-profiles';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { StartViewAsForm } from '../view-as/start-form';

export const dynamic = 'force-dynamic';

const demoSlugs = new Set(DEMO_CLIENT_PROFILES.map((p) => p.slug));

type PortalState = { label: string; tone: StatusTone; openable: boolean };

/** Building and suspended portals cannot be opened. Active ones and the demo workspaces can. */
function portalState(status: string, slug: string): PortalState {
  if (status === 'active') return { label: 'Ready', tone: 'success', openable: true };
  if (status === 'onboarding' && demoSlugs.has(slug))
    return { label: 'Demo', tone: 'info', openable: true };
  if (status === 'onboarding') return { label: 'Building', tone: 'warning', openable: false };
  return { label: 'Suspended', tone: 'error', openable: false };
}

export default async function ClientPortalsPage() {
  const user = await requireUser(await headers());
  if (!user.kyneticRole) forbidden();
  const rows = (await listAdminTenantOverview({ userId: user.id, role: user.kyneticRole })).filter(
    (r) => r.status !== 'offboarded'
  );
  return (
    <PageContainer
      pageTitle='Client portals'
      pageDescription='Open a client workspace as that client sees it, to click around and test. Read-only unless an admin turns on write mode. Every session is logged. A portal that is still being built cannot be opened yet.'
    >
      {rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No clients yet.</p>
      ) : (
        <ul className='divide-y rounded-lg border'>
          {rows.map((r) => {
            const state = portalState(r.status, r.slug);
            return (
              <li key={r.tenantId} className='space-y-2 p-4'>
                <div className='flex flex-wrap items-center gap-3'>
                  <p className='font-medium'>{r.name}</p>
                  <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                </div>
                {state.openable ? (
                  <StartViewAsForm
                    tenantId={r.tenantId}
                    tenantName={r.name}
                    reasonRequired={user.kyneticRole !== 'admin'}
                  />
                ) : (
                  <p className='text-muted-foreground text-sm'>
                    {state.label === 'Building'
                      ? 'Not ready yet. This opens once the portal is live.'
                      : 'Suspended. Not available.'}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </PageContainer>
  );
}
