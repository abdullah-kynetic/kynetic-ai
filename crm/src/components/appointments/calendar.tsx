import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { BusinessHours } from '@/server/settings/hours';
import {
  CALENDAR_END_HOUR,
  CALENDAR_START_HOUR,
  addCalendarDays,
  hourIsOpen,
  shiftAnchor,
  mondayIndex,
  startOfWeek,
  visibleRange,
  zonedDateTime,
  type CalendarView
} from './model';

export type CalendarItem = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: string;
  bookedBy: string;
  notes: string | null;
  contactName: string | null;
};

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function href(view: CalendarView, date: string) {
  return `/dashboard/appointments?view=${view}&date=${date}`;
}

function hourLabel(hour: number) {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const clock = hour % 12 === 0 ? 12 : hour % 12;
  return `${clock} ${suffix}`;
}

export function AppointmentsCalendar({
  view,
  date,
  timeZone,
  hours,
  items,
  cancelAction,
  rescheduleAction
}: {
  view: CalendarView;
  date: string;
  timeZone: string;
  hours: BusinessHours;
  items: CalendarItem[];
  cancelAction: (id: string) => void | Promise<void>;
  rescheduleAction: (id: string, form: FormData) => void | Promise<void>;
}) {
  const range = visibleRange(view, date);
  const previous = shiftAnchor(view, date, -1);
  const next = shiftAnchor(view, date, 1);
  const hoursConfigured = (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const).some(
    (day) => (hours[day] ?? []).length > 0
  );
  const placed = items.map((item) => ({ item, when: zonedDateTime(item.startsAt, timeZone) }));

  return (
    <div className='grid gap-4'>
      <div className='flex flex-wrap items-center gap-2'>
        <a
          className='inline-flex min-h-11 items-center rounded border px-3'
          href={href(view, previous)}
        >
          Previous
        </a>
        <a
          className='inline-flex min-h-11 items-center rounded border px-3'
          href={href(view, next)}
        >
          Next
        </a>
        {(['day', 'week', 'month'] as const).map((name) => (
          <a
            key={name}
            aria-current={name === view ? 'page' : undefined}
            className='inline-flex min-h-11 items-center rounded border px-3 capitalize hover:bg-muted'
            href={href(name, date)}
          >
            {name}
          </a>
        ))}
        <p className='text-muted-foreground text-sm'>Times are {timeZone}.</p>
      </div>
      <p className='text-sm'>
        {hoursConfigured
          ? 'Shaded hours are outside business hours.'
          : 'Business hours are not set yet, so nothing is shaded.'}
      </p>
      {view === 'month' ? (
        <MonthGrid date={date} placed={placed} />
      ) : (
        <HourGrid
          view={view}
          date={date}
          rangeStart={range.start}
          hours={hours}
          placed={placed}
          cancelAction={cancelAction}
          rescheduleAction={rescheduleAction}
        />
      )}
      {items.length === 0 ? (
        <p className='text-muted-foreground'>No appointments in this window.</p>
      ) : null}
    </div>
  );
}

function MonthGrid({
  date,
  placed
}: {
  date: string;
  placed: { item: CalendarItem; when: { date: string; label: string } }[];
}) {
  const first = `${date.slice(0, 7)}-01`;
  const start = startOfWeek(first);
  const days = Array.from({ length: 42 }, (_, index) => addCalendarDays(start, index));
  return (
    <div>
      <div className='grid grid-cols-7 gap-1 text-center text-sm font-medium'>
        {WEEKDAY_LABELS.map((label) => (
          <div key={label}>{label}</div>
        ))}
      </div>
      <div className='mt-1 grid grid-cols-7 gap-1'>
        {days.map((day) => {
          const inMonth = day.slice(0, 7) === date.slice(0, 7);
          const matches = placed.filter((row) => row.when.date === day);
          return (
            <div key={day} className={`min-h-24 rounded border p-1 ${inMonth ? '' : 'opacity-50'}`}>
              <a
                className='inline-flex min-h-11 min-w-11 items-center justify-center rounded'
                href={href('day', day)}
              >
                <span className='sr-only'>Open </span>
                {day.slice(-2)}
              </a>
              <ul className='grid gap-1'>
                {matches.map(({ item, when }) => (
                  <li key={item.id} className='truncate text-xs'>
                    {when.label} {item.contactName ?? 'Appointment'}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HourGrid({
  view,
  date,
  rangeStart,
  hours,
  placed,
  cancelAction,
  rescheduleAction
}: {
  view: 'day' | 'week';
  date: string;
  rangeStart: string;
  hours: BusinessHours;
  placed: { item: CalendarItem; when: { date: string; minutes: number; label: string } }[];
  cancelAction: (id: string) => void | Promise<void>;
  rescheduleAction: (id: string, form: FormData) => void | Promise<void>;
}) {
  const days =
    view === 'day'
      ? [date]
      : Array.from({ length: 7 }, (_, index) => addCalendarDays(rangeStart, index));
  const hoursOfDay = Array.from(
    { length: CALENDAR_END_HOUR - CALENDAR_START_HOUR },
    (_, index) => CALENDAR_START_HOUR + index
  );
  const outside = placed.filter((row) => {
    const hour = Math.floor(row.when.minutes / 60);
    return !days.includes(row.when.date) || hour < CALENDAR_START_HOUR || hour >= CALENDAR_END_HOUR;
  });
  return (
    <div className='grid gap-4 overflow-x-auto'>
      <table className='w-full border-collapse text-sm'>
        <caption className='sr-only'>
          {view === 'day' ? `Day of ${date}` : `Week of ${rangeStart}`}
        </caption>
        <thead>
          <tr>
            <th scope='col' className='p-2 text-left'>
              Time
            </th>
            {days.map((day) => (
              <th key={day} scope='col' className='p-2 text-left'>
                <a
                  className='inline-flex min-h-11 min-w-11 items-center px-1'
                  href={href('day', day)}
                >
                  {WEEKDAY_LABELS[mondayIndex(day)]} {day.slice(-2)}
                </a>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {hoursOfDay.map((hour) => (
            <tr key={hour}>
              <th scope='row' className='p-2 text-left font-normal whitespace-nowrap'>
                {hourLabel(hour)}
              </th>
              {days.map((day) => {
                const open = hourIsOpen(hours, day, hour);
                const matches = placed.filter(
                  (row) => row.when.date === day && Math.floor(row.when.minutes / 60) === hour
                );
                return (
                  <td
                    key={day}
                    className={`border p-1 align-top ${open === false ? 'bg-muted' : ''}`}
                    data-outside-hours={open === false ? 'true' : undefined}
                  >
                    <ul className='grid gap-1'>
                      {matches.map(({ item, when }) => (
                        <li key={item.id}>
                          <p>
                            {when.label} · {item.contactName ?? 'Appointment'}
                          </p>
                          {view === 'day' ? (
                            <ItemActions
                              item={item}
                              cancelAction={cancelAction}
                              rescheduleAction={rescheduleAction}
                            />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {outside.length > 0 ? (
        <section aria-labelledby='outside-hours'>
          <h2 id='outside-hours' className='font-medium'>
            Also in this view
          </h2>
          <ul className='mt-2 grid gap-2'>
            {outside.map(({ item, when }) => (
              <li key={item.id}>
                {when.date} {when.label} · {item.contactName ?? 'Appointment'}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function ItemActions({
  item,
  cancelAction,
  rescheduleAction
}: {
  item: CalendarItem;
  cancelAction: (id: string) => void | Promise<void>;
  rescheduleAction: (id: string, form: FormData) => void | Promise<void>;
}) {
  if (item.status === 'cancelled') return null;
  return (
    <div className='mt-2 flex flex-wrap gap-2'>
      <form action={cancelAction.bind(null, item.id)}>
        <Button type='submit' variant='outline'>
          Cancel
        </Button>
      </form>
      <form action={rescheduleAction.bind(null, item.id)} className='flex flex-wrap gap-2'>
        <div className='grid gap-1'>
          <label htmlFor={`start-${item.id}`} className='text-xs'>
            New start time
          </label>
          <Input id={`start-${item.id}`} name='startsAt' type='datetime-local' required />
        </div>
        <div className='grid gap-1'>
          <label htmlFor={`end-${item.id}`} className='text-xs'>
            New end time
          </label>
          <Input id={`end-${item.id}`} name='endsAt' type='datetime-local' required />
        </div>
        <Button type='submit' variant='outline'>
          Reschedule
        </Button>
      </form>
    </div>
  );
}
