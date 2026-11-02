import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { getReport } from '@/server/reports';
import { isModuleEnabled } from '@/server/modules';
import { presenceReport } from '@/server/presence';
import { loadShellContext } from '@/server/shell';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, cookieStore, requestHeaders] = await Promise.all([params, cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) notFound();
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  const report = await getReport(ctx, id);
  if (!report) notFound();
  const presence = (await isModuleEnabled(ctx, 'opm'))
    ? await presenceReport(ctx, report.periodStart)
    : null;
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
      {presence && (
        <Card className='mt-4'>
          <CardHeader>
            <CardTitle>Online Presence</CardTitle>
          </CardHeader>
          <CardContent>
            {presence.snapshots.length ? (
              <ul className='space-y-2'>
                {presence.snapshots.map((snapshot) => (
                  <li key={snapshot.id}>
                    {snapshot.source}: {snapshot.reviewCount} reviews
                    {snapshot.averageRating && ` · ${snapshot.averageRating}/5`} (
                    {snapshot.capturedOn})
                  </li>
                ))}
              </ul>
            ) : (
              <p>No review snapshots were recorded this month.</p>
            )}
          </CardContent>
        </Card>
      )}
    </PageContainer>
  );
}
