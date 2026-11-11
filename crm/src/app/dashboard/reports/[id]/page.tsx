import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DailyTrend } from '../../metrics-charts';
import { getReportDetail } from '@/server/reports';
import { isModuleEnabled, requireModule } from '@/server/modules';
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
  await requireModule(ctx, 'platform');
  const detail = await getReportDetail(ctx, id);
  if (!detail) notFound();
  const { report, content, source } = detail;
  const performance = content.sections.performance.data;
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
          <p className='text-muted-foreground mt-2 text-sm'>{source}</p>
          <p className='text-muted-foreground mt-4 text-sm'>Generated {report.createdAt}</p>
        </CardContent>
      </Card>
      <dl className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4' aria-label='Report totals'>
        {[
          ['Leads', performance.leads],
          [
            'Speed to lead',
            performance.speedToLeadMinutes == null
              ? 'No calls yet'
              : `${performance.speedToLeadMinutes} min`
          ],
          ['Calls', performance.calls],
          ['Reached', performance.reached ?? 0],
          ['Booked', performance.booked],
          [
            'Booking rate',
            performance.bookingRate == null ? 'No leads yet' : `${performance.bookingRate}%`
          ],
          [
            'Won revenue',
            `$${(content.sections.revenue.data.revenueCents / 100).toLocaleString('en-US')}`
          ],
          ['Guarantee result', content.sections.guarantee.data.result]
        ].map(([label, value]) => (
          <div key={label} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
            <dt className='text-muted-foreground text-sm'>{label}</dt>
            <dd className='mt-2 text-xl font-semibold'>{value}</dd>
          </div>
        ))}
      </dl>
      <div className='mt-4'>
        <DailyTrend days={content.sections.daily.data.days} name='Monthly leads and bookings' />
      </div>
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
