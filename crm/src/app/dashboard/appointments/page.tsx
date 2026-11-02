import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { moduleSatisfied } from '@/server/modules/keys';
import { loadShellContext } from '@/server/shell';
import { listAppointments } from '@/server/appointments';
import { getBusinessSettings } from '@/server/settings/business';
import {
  cancelAppointmentAction,
  createAppointmentAction,
  rescheduleAppointmentForm
} from './actions';
import { NoAccess } from '@/components/ui/states';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const metadata = { title: 'Appointments', robots: { index: false, follow: false } };

function dayStart(at: Date) {
  const d = new Date(at);
  d.setHours(0, 0, 0, 0);
  return d;
}

function presentAppointments(rows: Awaited<ReturnType<typeof listAppointments>>, timezone: string) {
  return rows.map(({ appointment }) => ({
    appointment,
    // Server components render this once per request; the source timestamps are immutable.
    // eslint-disable-next-line react/purity
    startText: new Intl.DateTimeFormat('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: timezone
    }).format(new Date(appointment.startsAt)),
    // eslint-disable-next-line react/purity
    endText: new Intl.DateTimeFormat('en-US', {
      timeStyle: 'short',
      timeZone: timezone
    }).format(new Date(appointment.endsAt))
  }));
}

export default async function AppointmentsPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const [sp, cookieStore, requestHeaders] = await Promise.all([searchParams, cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) notFound();
  const enabled = { keys: new Set(shell.modules.keys), crmLevel: shell.modules.crmLevel };
  if (!moduleSatisfied(enabled, { module: 'crm', level: 'lite' })) {
    return (
      <PageContainer pageTitle='Appointments'>
        <NoAccess
          title='Appointments are not part of your plan'
          description='Ask your Kynetic contact about adding the CRM.'
        />
      </PageContainer>
    );
  }
  // The page is a server component; the request-time clock is intentional for the default range.
  const view = sp.view === 'day' || sp.view === 'month' ? sp.view : 'week';
  // eslint-disable-next-line react/purity
  const parsed = sp.date ? new Date(`${sp.date}T00:00:00`) : new Date();
  // eslint-disable-next-line react/purity
  const start = dayStart(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
  // eslint-disable-next-line react/purity
  const end = new Date(start);
  end.setDate(end.getDate() + (view === 'day' ? 1 : view === 'month' ? 31 : 7));
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  const [rows, business] = await Promise.all([
    listAppointments(ctx, start, end),
    getBusinessSettings(ctx)
  ]);
  const displayRows = presentAppointments(rows, business.timezone);
  return (
    <PageContainer
      pageTitle='Appointments'
      pageDescription='Your team calendar for the next seven days.'
    >
      <div className='mb-4 flex flex-wrap gap-2 text-sm'>
        {(['day', 'week', 'month'] as const).map((name) => (
          <a
            key={name}
            className='inline-flex min-h-11 items-center rounded border px-3 capitalize hover:bg-muted'
            href={`/dashboard/appointments?view=${name}`}
          >
            {name}
          </a>
        ))}
      </div>
      <Card className='mb-4'>
        <CardHeader>
          <CardTitle>Book an appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAppointmentAction} className='grid gap-3 md:grid-cols-4'>
            <label className='grid gap-1 text-sm'>
              Contact ID (optional)
              <input
                name='contactId'
                placeholder='Contact ID (optional)'
                className='min-h-11 rounded border px-3 py-2'
              />
            </label>
            <div className='grid gap-1 text-sm'>
              <label htmlFor='book-starts-at'>Start time</label>
              <input
                id='book-starts-at'
                name='startsAt'
                type='datetime-local'
                required
                className='min-h-11 rounded border px-3 py-2'
              />
            </div>
            <div className='grid gap-1 text-sm'>
              <label htmlFor='book-ends-at'>End time</label>
              <input
                id='book-ends-at'
                name='endsAt'
                type='datetime-local'
                required
                className='min-h-11 rounded border px-3 py-2'
              />
            </div>
            <button
              className='min-h-11 rounded bg-primary px-3 py-2 text-primary-foreground'
              type='submit'
            >
              Book
            </button>
          </form>
        </CardContent>
      </Card>
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
        {rows.length === 0 ? (
          <Card>
            <CardContent className='text-muted-foreground py-8'>
              No appointments in this window.
            </CardContent>
          </Card>
        ) : (
          displayRows.map(({ appointment, startText, endText }) => (
            <Card key={appointment.id}>
              <CardHeader>
                <CardTitle>{startText}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{endText}</p>
                <p className='text-muted-foreground mt-1'>
                  {appointment.status} · booked by {appointment.bookedBy}
                </p>
                {appointment.notes && <p className='mt-3'>{appointment.notes}</p>}
                {appointment.status !== 'cancelled' && (
                  <div className='mt-4 flex gap-2'>
                    <form action={cancelAppointmentAction.bind(null, appointment.id)}>
                      <button className='min-h-11 rounded border px-3 py-2 text-xs' type='submit'>
                        Cancel
                      </button>
                    </form>
                    <form
                      action={rescheduleAppointmentForm.bind(null, appointment.id)}
                      className='flex flex-wrap gap-1'
                    >
                      <div className='grid gap-1 text-xs'>
                        <label htmlFor={`reschedule-start-${appointment.id}`}>New start time</label>
                        <input
                          id={`reschedule-start-${appointment.id}`}
                          name='startsAt'
                          type='datetime-local'
                          required
                          className='min-h-11 w-full rounded border px-2 py-1 text-xs sm:w-36'
                        />
                      </div>
                      <div className='grid gap-1 text-xs'>
                        <label htmlFor={`reschedule-end-${appointment.id}`}>New end time</label>
                        <input
                          id={`reschedule-end-${appointment.id}`}
                          name='endsAt'
                          type='datetime-local'
                          required
                          className='min-h-11 w-full rounded border px-2 py-1 text-xs sm:w-36'
                        />
                      </div>
                      <button className='min-h-11 rounded border px-3 py-2 text-xs' type='submit'>
                        Reschedule
                      </button>
                    </form>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </PageContainer>
  );
}
