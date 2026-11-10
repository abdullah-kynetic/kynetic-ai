import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { getReportScheduleForAdmin } from '@/server/admin/report-schedule';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';
import { saveClientEmailAction, saveReportDayAction } from './actions';

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
      {query.saved === '1' && <p role='status'>Report day saved.</p>}
      {query.saved === 'email' && (
        <p role='status'>Email settings saved. Both stay off until the server flag is on too.</p>
      )}
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
      <form
        action={saveClientEmailAction.bind(null, tenantId)}
        className='mt-8 grid max-w-md gap-3'
      >
        <h2 className='text-lg font-semibold'>Client email</h2>
        <p>
          Weekly results and the monthly report link stay off unless this client is checked and the
          server flag is on. Nothing is attached.
        </p>
        <label className='flex min-h-11 items-center gap-2'>
          <input name='weekly' type='checkbox' defaultChecked={schedule.weeklyEmailEnabled} />
          Weekly email on Monday morning
        </label>
        <label className='flex min-h-11 items-center gap-2'>
          <input name='report' type='checkbox' defaultChecked={schedule.reportEmailEnabled} />
          Email a link when the monthly report is ready
        </label>
        <button className='min-h-11 rounded border px-4' type='submit'>
          Save email settings
        </button>
      </form>
    </PageContainer>
  );
}
