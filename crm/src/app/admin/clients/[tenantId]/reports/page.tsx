import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { getReportScheduleForAdmin } from '@/server/admin/report-schedule';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';
import { saveReportDayAction } from './actions';

export const dynamic = 'force-dynamic';

export default async function ClientReportSchedulePage({
  params,
  searchParams
}: {
  params: Promise<{ tenantId: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const [{ tenantId }, query] = await Promise.all([params, searchParams]);
  const schedule = await getReportScheduleForAdmin(
    { id: access.user.id, kyneticRole: access.role },
    tenantId
  ).catch((error: unknown) => {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  });
  return (
    <PageContainer
      pageTitle='Report schedule'
      pageDescription='The monthly ROI report runs on this day in the client timezone. Days are 1 to 28 so every month has the day.'
    >
      {query.saved && <p role='status'>Report day saved.</p>}
      {query.error === 'invalid' && <p role='alert'>Choose a day from 1 to 28.</p>}
      {query.error === 'forbidden' && <p role='alert'>Only a Kynetic admin can change this.</p>}
      {query.error === 'failed' && <p role='alert'>The report day could not be saved.</p>}
      <form action={saveReportDayAction.bind(null, tenantId)} className='grid max-w-md gap-4'>
        <p>
          Current schedule: day {schedule.day} in {schedule.timezone}.
        </p>
        <label className='grid gap-1'>
          Day of month
          <input
            className='min-h-11 rounded border px-3'
            name='day'
            type='number'
            min={1}
            max={28}
            required
            defaultValue={schedule.day}
          />
        </label>
        <button className='min-h-11 rounded border px-4' type='submit'>
          Save report day
        </button>
      </form>
    </PageContainer>
  );
}
