import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { buttonVariants } from '@/components/ui/button';
import { StatusPill, type Tone } from '@/components/ui/status-pill';
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

const healthPill: Record<'green' | 'yellow' | 'red', { tone: Tone; word: string }> = {
  green: { tone: 'gain', word: 'Healthy' },
  yellow: { tone: 'attention', word: 'Watch' },
  red: { tone: 'alert', word: 'At risk' }
};
const demoSlugs = new Set(DEMO_CLIENT_PROFILES.map((p) => p.slug));

function portalStatus(status: string, slug: string) {
  if (status === 'active') return { label: 'Ready', tone: 'gain' as Tone, openable: true };
  if (status === 'onboarding' && demoSlugs.has(slug))
    return { label: 'Demo', tone: 'neutral' as Tone, openable: true };
  if (status === 'onboarding')
    return { label: 'Building', tone: 'attention' as Tone, openable: false };
  return { label: 'Suspended', tone: 'alert' as Tone, openable: false };
}

export default async function ClientsIndexPage() {
  const user = await requireUser(await headers());
  if (!user.kyneticRole) forbidden();
  const rows = (await listAdminTenantOverview({ userId: user.id, role: user.kyneticRole })).filter(
    (r) => r.status !== 'offboarded'
  );
  const needAttention = rows.filter((r) => r.healthTone !== 'green').length;
  const building = rows.filter((r) => portalStatus(r.status, r.slug).label === 'Building').length;
  const ready = rows.filter((r) => portalStatus(r.status, r.slug).label === 'Ready').length;
  const headline = needAttention
    ? `${needAttention} of ${rows.length} ${rows.length === 1 ? 'client needs' : 'clients need'} a look`
    : `All ${rows.length} ${rows.length === 1 ? 'client is' : 'clients are'} on track`;
  const stats: { label: string; value: number; unit: string }[] = [
    { label: 'Clients', value: rows.length, unit: 'not offboarded' },
    { label: 'Portals ready', value: ready, unit: `of ${rows.length}` },
    { label: 'Portals building', value: building, unit: `of ${rows.length}` },
    { label: 'Need a look', value: needAttention, unit: `of ${rows.length}` }
  ];
  return (
    <div className='mx-auto flex w-full max-w-[1280px] flex-1 flex-col gap-6 px-4 pt-2 pb-8 md:px-6 md:pt-4'>
      <PageHeader
        title='All clients'
        description={headline}
        actions={
          <Link href='/admin/clients/new' className={buttonVariants({ variant: 'default' })}>
            Onboard a client
          </Link>
        }
      />
      <ul aria-label='Clients in numbers' className='grid grid-cols-2 gap-4 lg:grid-cols-4'>
        {stats.map((stat) => (
          <li
            key={stat.label}
            className='bg-card flex flex-col gap-1 rounded-[var(--radius-card)] border p-5'
          >
            <span className='text-muted-foreground text-[13px] font-medium'>{stat.label}</span>
            <span className='text-4xl/[1.05] font-semibold tracking-tight tabular-nums'>
              {stat.value}
            </span>
            <span className='text-muted-foreground text-xs'>{stat.unit}</span>
          </li>
        ))}
      </ul>
      <div className='bg-card overflow-hidden rounded-[var(--radius-card)] border'>
        <Table scrollLabel='Clients table'>
          <TableHeader className='bg-surface-sunken'>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className='hidden md:table-cell'>Plan</TableHead>
              <TableHead>Health</TableHead>
              <TableHead className='hidden md:table-cell'>Open as client</TableHead>
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
                const health = healthPill[row.healthTone];
                return (
                  <TableRow key={row.tenantId}>
                    <TableCell className='font-medium'>
                      <Link
                        className='inline-flex min-h-11 items-center underline-offset-4 hover:underline'
                        href={`/admin/clients/${row.tenantId}`}
                      >
                        {row.name}
                      </Link>
                      <div className='mt-1 md:hidden'>
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
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={state.tone}>{state.label}</StatusPill>
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
                      {row.plan} {row.pricingTier ?? ''}
                    </TableCell>
                    <TableCell>
                      <StatusPill tone={health.tone}>
                        {row.healthScore} · {health.word}
                      </StatusPill>
                    </TableCell>
                    <TableCell className='hidden md:table-cell'>
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
      </div>
      <p className='text-muted-foreground text-xs'>
        Health: green ≥70, yellow ≥40, red &lt;40. Healthy, Watch and At risk follow those cut-offs.
      </p>
    </div>
  );
}
