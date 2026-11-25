import Link from 'next/link';
import { ShopPage } from '@/components/shop/shop-page';
import { StatusPill } from '@/components/ui/status-pill';
import { getShopCalendar } from '@/server/shop';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

const KIND_LABEL = {
  'drop-off': 'Drop-off',
  estimate: 'Estimate',
  pickup: 'Pickup',
  other: 'Appointment'
} as const;
const KIND_TONE = {
  'drop-off': 'attention',
  estimate: 'neutral',
  pickup: 'gain',
  other: 'neutral'
} as const;

const shift = (key: string, days: number) => {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
const dayHeading = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });

export default async function CalendarPage({
  searchParams
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const ctx = await shopContext();
  const { week } = await searchParams;
  const cal = await getShopCalendar(ctx, { anchor: week });
  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone: cal.timeZone
    });
  const link =
    'focus-visible:ring-ring bg-card hover:bg-muted inline-flex min-h-11 items-center rounded-lg border px-4 text-sm focus-visible:ring-2 focus-visible:outline-none';
  return (
    <ShopPage ctx={ctx} title='Calendar' description='Drop-offs, estimates and pickups.'>
      <nav aria-label='Week' className='flex flex-wrap items-center gap-2'>
        <Link className={link} href={`/dashboard/shop/calendar?week=${shift(cal.from, -7)}`}>
          Previous week
        </Link>
        <Link className={link} href='/dashboard/shop/calendar'>
          This week
        </Link>
        <Link className={link} href={`/dashboard/shop/calendar?week=${shift(cal.from, 7)}`}>
          Next week
        </Link>
        <span className='text-muted-foreground text-sm'>
          {dayHeading(cal.from)} to {dayHeading(cal.to)}
        </span>
      </nav>
      <ol className='grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4'>
        {cal.days.map((d) => (
          <li key={d.key} className='bg-card min-w-0 rounded-[var(--radius-card)] border p-4'>
            <h2 className='text-sm font-medium'>{dayHeading(d.key)}</h2>
            {d.items.length ? (
              <ul className='mt-3 flex flex-col gap-3'>
                {d.items.map((a) => (
                  <li key={a.id} className='flex flex-col gap-1 rounded-lg border p-3 text-sm'>
                    <span className='flex flex-wrap items-center gap-2'>
                      <StatusPill tone={KIND_TONE[a.kind]}>{KIND_LABEL[a.kind]}</StatusPill>
                      <span className='text-muted-foreground text-xs tabular-nums'>
                        {time(a.startsAt)}
                      </span>
                    </span>
                    {a.contactId ? (
                      <Link
                        href={`/dashboard/shop/leads/${a.contactId}`}
                        className='text-primary-text font-medium underline underline-offset-4'
                      >
                        {a.customerName ?? 'Customer'}
                      </Link>
                    ) : (
                      <span className='font-medium'>{a.customerName ?? 'No customer'}</span>
                    )}
                    {a.vehicleLabel ? (
                      <span className='text-muted-foreground'>{a.vehicleLabel}</span>
                    ) : null}
                    <span className='text-muted-foreground text-xs'>
                      {cal.remindersOn ? 'Reminder on' : 'No reminder set'}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className='text-muted-foreground mt-2 text-sm'>Nothing scheduled.</p>
            )}
          </li>
        ))}
      </ol>
    </ShopPage>
  );
}
