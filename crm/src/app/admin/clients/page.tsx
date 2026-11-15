import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { StatusBadge, type StatusTone } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { listAdminTenantOverview } from '@/server/admin';
import { requireUser } from '@/server/auth';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { DEMO_CLIENT_PROFILES } from '@/server/db/seed/demo-client-profiles';
import { StartViewAsForm } from '../view-as/start-form';

const tones: Record<'green' | 'yellow' | 'red', StatusTone> = {
  green: 'success',
  yellow: 'warning',
  red: 'error'
};
const demoSlugs = new Set(DEMO_CLIENT_PROFILES.map((p) => p.slug));

function portalStatus(status: string, slug: string) {
  if (status === 'active') return { label: 'Ready', tone: 'success' as const, openable: true };
  if (status === 'onboarding' && demoSlugs.has(slug))
    return { label: 'Demo', tone: 'info' as const, openable: true };
  if (status === 'onboarding')
    return { label: 'Building', tone: 'warning' as const, openable: false };
  return { label: 'Suspended', tone: 'error' as const, openable: false };
}

export default async function ClientsIndexPage() {
  const user = await requireUser(await headers());
  if (!user.kyneticRole) forbidden();
  const rows = (await listAdminTenantOverview({ userId: user.id, role: user.kyneticRole })).filter(
    (r) => r.status !== 'offboarded'
  );
  return (
    <PageContainer
      pageTitle='All clients'
      pageDescription='Every non-offboarded client, with status and health signals. Health: green ≥70, yellow ≥40, red <40.'
    >
      <div className='mb-4 flex flex-wrap gap-3'>
        <Link href='/admin/clients/new' className='inline-flex min-h-11 items-center underline'>
          Onboard a client
        </Link>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Open as client</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5}>No clients yet.</TableCell>
            </TableRow>
          ) : (
            rows.map((row) => {
              const state = portalStatus(row.status, row.slug);
              return (
                <TableRow key={row.tenantId}>
                  <TableCell className='font-medium'>
                    <Link
                      className='inline-flex min-h-11 items-center underline'
                      href={`/admin/clients/${row.tenantId}`}
                    >
                      {row.name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={state.tone}>{state.label}</StatusBadge>
                  </TableCell>
                  <TableCell>
                    {row.plan} {row.pricingTier ?? ''}
                  </TableCell>
                  <TableCell>
                    <StatusBadge tone={tones[row.healthTone]}>
                      {row.healthScore} · {row.healthTone}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    {state.openable ? (
                      <StartViewAsForm
                        tenantId={row.tenantId}
                        tenantName={row.name}
                        reasonRequired={user.kyneticRole !== 'admin'}
                      />
                    ) : (
                      <span className='text-muted-foreground text-sm'>
                        {state.label === 'Building' ? 'Not ready yet' : 'Not available'}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </PageContainer>
  );
}
