import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AppointmentsCalendar } from '@/components/appointments/calendar';
import { ContactPicker } from '@/components/appointments/contact-picker';
import { parseCalendarView, visibleRange, zonedMidnight } from '@/components/appointments/model';
import { moduleSatisfied } from '@/server/modules/keys';
import { loadShellContext } from '@/server/shell';
import { listAppointments } from '@/server/appointments';
import { getBusinessSettings } from '@/server/settings/business';
import { calendarDateInTimeZone } from '@/server/metrics';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import {
  cancelAppointmentAction,
  createAppointmentAction,
  rescheduleAppointmentForm
} from './actions';
import { NoAccess } from '@/components/ui/states';
import { cookies, headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';

export const metadata = { title: 'Appointments', robots: { index: false, follow: false } };

export default async function AppointmentsPage({
  searchParams
}: {
  searchParams: Promise<{ date?: string; view?: string }>;
}) {
  const [sp, cookieStore, requestHeaders] = await Promise.all([searchParams, cookies(), headers()]);
  const shell = await loadShellContext(
    requestHeaders,
    cookieStore.get('tenant_id')?.value,
    undefined,
    cookieStore.get(VIEW_AS_COOKIE)?.value
  );
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
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  const business = await getBusinessSettings(ctx);
  // The page is a server component; the request-time clock is the default date.
  // eslint-disable-next-line react/purity
  const today = calendarDateInTimeZone(new Date(), business.timezone);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? '') ? sp.date! : today;
  const view = parseCalendarView(sp.view);
  const range = visibleRange(view, date);
  const rows = await listAppointments(
    ctx,
    zonedMidnight(range.start, business.timezone),
    zonedMidnight(range.end, business.timezone)
  );
  return (
    <PageContainer
      pageTitle='Appointments'
      pageDescription='Month, week, and day views of your booked estimates.'
    >
      <Card className='mb-4'>
        <CardHeader>
          <CardTitle>Book an appointment</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAppointmentAction} className='grid gap-3 md:grid-cols-4'>
            <ContactPicker />
            <div className='grid gap-1 text-sm'>
              <label htmlFor='book-starts-at'>Start time</label>
              <Input id='book-starts-at' name='startsAt' type='datetime-local' required />
            </div>
            <div className='grid gap-1 text-sm'>
              <label htmlFor='book-ends-at'>End time</label>
              <Input id='book-ends-at' name='endsAt' type='datetime-local' required />
            </div>
            <Button type='submit' className='self-end'>
              Book
            </Button>
          </form>
        </CardContent>
      </Card>
      <AppointmentsCalendar
        view={view}
        date={date}
        timeZone={business.timezone}
        hours={business.businessHours}
        items={rows.map(({ appointment, contactName }) => ({
          id: appointment.id,
          startsAt: appointment.startsAt,
          endsAt: appointment.endsAt,
          status: appointment.status,
          bookedBy: appointment.bookedBy,
          notes: appointment.notes,
          contactName
        }))}
        cancelAction={cancelAppointmentAction}
        rescheduleAction={rescheduleAppointmentForm}
      />
    </PageContainer>
  );
}
