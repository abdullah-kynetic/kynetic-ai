import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loadShellContext } from '@/server/shell';
import { listReports } from '@/server/reports';
import { readReportSchedule } from '@/server/schedules';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ReportsPage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) redirect('/dashboard');
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  const [reports, schedule] = await Promise.all([listReports(ctx), readReportSchedule(ctx)]);
  return (
    <PageContainer pageTitle='Reports' pageDescription='Monthly return and activity reports.'>
      <p className='mb-4'>
        The monthly ROI report is generated on day {schedule.day} of each month ({schedule.timezone}
        ).
      </p>
      <div className='grid gap-4 md:grid-cols-2 lg:grid-cols-3'>
        {reports.length ? (
          reports.map((report) => (
            <Card key={report.id}>
              <CardHeader>
                <CardTitle>{report.periodStart}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className='capitalize'>{report.kind.replace('_', ' ')}</p>
                <p className='text-muted-foreground mt-1'>Status: {report.status}</p>
                <Link
                  className='text-primary-text mt-3 inline-block text-sm underline-offset-4 hover:underline'
                  href={`/dashboard/reports/${report.id}`}
                >
                  Open report
                </Link>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className='text-muted-foreground py-8'>
              No reports have been generated yet.
            </CardContent>
          </Card>
        )}
      </div>
    </PageContainer>
  );
}
