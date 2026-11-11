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
import { requireUser } from '@/server/auth';
import { listAdminTenantOverview } from '@/server/admin';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import Link from 'next/link';

const tones: Record<'green' | 'yellow' | 'red', StatusTone> = {
  green: 'success',
  yellow: 'warning',
  red: 'error'
};

// Entry point for the admin side. The client table (F-53) and health chips (F-54) arrive in M8b.
export default async function AdminHomePage() {
  const user = await requireUser(await headers());
  if (!user.kyneticRole) forbidden();
  const rows = await listAdminTenantOverview({ userId: user.id, role: user.kyneticRole });
  return (
    <PageContainer
      pageTitle='All clients'
      pageDescription='Every client in one place, with performance and health signals. Health: green ≥70, yellow ≥40, red <40.'
    >
      {user.kyneticRole === 'admin' && (
        <Link href='/admin/agency' className='mb-4 inline-flex min-h-11 items-center underline'>
          Open agency workspace
        </Link>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Client</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Leads (30d)</TableHead>
            <TableHead>Bookings</TableHead>
            <TableHead>MRR inputs</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Documents</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7}>No clients yet.</TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
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
                  {row.plan} {row.pricingTier ?? ''}
                </TableCell>
                <TableCell>{row.leads30d}</TableCell>
                <TableCell>{row.appointments30d}</TableCell>
                <TableCell>
                  {row.modules.length} systems
                  {user.kyneticRole === 'admin' ? ' · $ to be confirmed' : ''}
                </TableCell>
                <TableCell>
                  <StatusBadge tone={tones[row.healthTone]}>
                    {row.healthScore} · {row.healthTone}
                  </StatusBadge>
                </TableCell>
                <TableCell>
                  <Link
                    className='min-h-11 inline-flex items-center underline'
                    href={`/admin/clients/${row.tenantId}/documents`}
                  >
                    Manage
                  </Link>
                  {user.kyneticRole === 'admin' && (
                    <>
                      <Link
                        className='ml-3 min-h-11 inline-flex items-center underline'
                        href={`/admin/clients/${row.tenantId}/webhooks`}
                      >
                        Webhooks
                      </Link>
                      <Link
                        className='ml-3 min-h-11 inline-flex items-center underline'
                        href={`/admin/clients/${row.tenantId}/reports`}
                      >
                        Reports
                      </Link>
                      <Link
                        className='ml-3 min-h-11 inline-flex items-center underline'
                        href={`/admin/clients/${row.tenantId}/service-tokens`}
                      >
                        Service tokens
                      </Link>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </PageContainer>
  );
}
