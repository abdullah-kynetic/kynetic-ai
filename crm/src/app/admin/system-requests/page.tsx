import PageContainer from '@/components/layout/page-container';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { decideAdminAccess } from '@/server/admin';
import { SYSTEM_CATALOG } from '@/server/modules/catalog';
import { listSystemRequestQueue } from '@/server/systems/requests';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { forbidden } from 'next/navigation';

export const metadata: Metadata = { title: 'System requests' };
export const dynamic = 'force-dynamic';

export default async function SystemRequestsPage() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const rows = await listSystemRequestQueue({ userId: access.user.id, role: access.role });
  return (
    <PageContainer
      pageTitle='System requests'
      pageDescription='Clients asked for these systems. Nothing is charged from this list.'
    >
      {rows.length === 0 ? (
        <p className='text-muted-foreground text-sm'>No system requests yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Client</TableHead>
              <TableHead>System</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  {new Date(row.createdAt).toLocaleString('en-US', {
                    dateStyle: 'medium',
                    timeStyle: 'short'
                  })}
                </TableCell>
                <TableCell>
                  <Link
                    href={`/admin/clients/${row.tenantId}`}
                    className='inline-flex min-h-11 items-center underline'
                  >
                    {row.tenantName}
                  </Link>
                </TableCell>
                <TableCell>{SYSTEM_CATALOG[row.moduleKey].label}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageContainer>
  );
}
