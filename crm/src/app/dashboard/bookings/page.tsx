import Link from 'next/link';
import { headers } from 'next/headers';
import { StatTiles } from '@/components/layout/stat-tiles';
import { NoAccess } from '@/components/ui/states';
import { contactsActorScope } from '@/server/contacts';
import { listAppointments } from '@/server/appointments';
import { AppError } from '@/server/errors';
import { DailyTrend } from '../metrics-charts';
import { loadAreaMetrics, percentLabel } from '../area-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Calls & bookings' };

export default async function BookingsOverviewPage() {
  const data = await loadAreaMetrics();
  if (!data)
    return (
      <NoAccess
        title='Calls and bookings are not available'
        description='Sign in to a client account to see your calls and bookings.'
      />
    );
  const { metrics, range, timeZone } = data;
  const scope = await contactsActorScope(await headers());
  let upcoming: Awaited<ReturnType<typeof listAppointments>> | null = null;
  try {
    const from = new Date();
    upcoming = scope
      ? await listAppointments(scope.ctx, from, new Date(from.getTime() + 14 * 86_400_000))
      : null;
  } catch (error) {
    if (!(error instanceof AppError && error.code === 'MODULE_DISABLED')) throw error;
  }
  const speed =
    metrics.totals.speedToLeadMinutes == null
      ? 'No calls yet'
      : `${metrics.totals.speedToLeadMinutes} min`;
  return (
    <div className='space-y-6'>
      <p className='text-muted-foreground text-sm'>
        Last 30 days, {range.from} to {range.to}.
      </p>
      <StatTiles
        label='Calls and bookings in numbers'
        tiles={[
          { label: 'Calls', value: String(metrics.totals.calls), note: 'Last 30 days' },
          {
            label: 'People reached',
            value: String(metrics.totals.contactsReached)
          },
          {
            label: 'Booked',
            value: String(metrics.totals.estimatesBooked),
            note: `${percentLabel(metrics.totals.bookingRate)} booking rate`
          },
          { label: 'Speed to lead', value: speed, note: 'Median, first call' }
        ]}
      />
      {metrics.totals.calls === 0 && metrics.totals.estimatesBooked === 0 && (
        <section className='bg-card space-y-2 rounded-xl border p-6'>
          <h2 className='font-semibold'>No calls or bookings yet</h2>
          <p className='text-muted-foreground text-sm'>
            Calls Alex handles and appointments that get booked show up here.
          </p>
        </section>
      )}
      <div className='grid min-w-0 gap-4 lg:grid-cols-2'>
        <DailyTrend days={metrics.days} name='Daily leads and bookings' />
        <section
          aria-label='Upcoming appointments'
          className='bg-card min-w-0 rounded-xl p-4 ring-1 ring-foreground/10'
        >
          <h2 className='font-medium'>Next 14 days</h2>
          {upcoming === null ? (
            <p className='text-muted-foreground mt-3 text-sm'>
              Appointments are not part of your plan.
            </p>
          ) : upcoming.length === 0 ? (
            <p className='text-muted-foreground mt-3 text-sm'>No upcoming appointments.</p>
          ) : (
            <ul className='mt-3 divide-y text-sm'>
              {upcoming.slice(0, 6).map(({ appointment, contactName }) => (
                <li key={appointment.id} className='flex justify-between gap-3 py-2'>
                  <span>{contactName ?? 'Appointment'}</span>
                  <time dateTime={appointment.startsAt} className='text-muted-foreground'>
                    {new Intl.DateTimeFormat('en-US', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                      timeZone
                    }).format(new Date(appointment.startsAt))}
                  </time>
                </li>
              ))}
            </ul>
          )}
          <div className='mt-3 flex gap-4 text-sm'>
            <Link className='text-primary underline' href='/dashboard/bookings/appointments'>
              Open appointments
            </Link>
            <Link className='text-primary underline' href='/dashboard/bookings/calls'>
              Open calls
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
