import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getReport } from '@/server/reports';
import { loadShellContext } from '@/server/shell';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, cookieStore, requestHeaders] = await Promise.all([params, cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) notFound();
  const report = await getReport(
    { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role },
    id
  );
  if (!report) notFound();
  return (
    <PageContainer
      pageTitle={`${report.periodStart} ROI report`}
      pageDescription='Tenant-scoped monthly report.'
    >
      <Card>
        <CardHeader>
          <CardTitle>{report.kind.replace('_', ' ')}</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Status: {report.status}</p>
          {report.storageKey && (
            <p className='text-muted-foreground mt-2 text-sm'>
              Report artifact: {report.storageKey}
            </p>
          )}
          <p className='text-muted-foreground mt-4 text-sm'>Generated {report.createdAt}</p>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
