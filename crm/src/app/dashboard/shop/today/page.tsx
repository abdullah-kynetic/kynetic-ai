import Link from 'next/link';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { StatTiles } from '@/components/layout/stat-tiles';
import { getToday } from '@/server/shop';
import { money } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const ctx = await shopContext();
  const today = await getToday(ctx);
  const t = today.tiles;
  return (
    <ShopPage
      ctx={ctx}
      title='Today'
      description='What needs you today, and what is running without you.'
    >
      <div className='grid gap-3 sm:gap-4'>
        <StatTiles
          label='The shop right now'
          tiles={[
            {
              label: 'Cars in shop',
              value: t.carsInShop,
              key: true,
              note: 'Past the estimate, not yet picked up'
            },
            { label: 'Drop-offs today', value: t.dropOffsToday },
            { label: 'New leads', value: t.newLeads, note: 'Not quoted yet' }
          ]}
        />
        <StatTiles
          label='Quotes, money and calls'
          tiles={[
            {
              label: 'Quotes waiting',
              value: t.quotesWaiting,
              note: 'Out with a customer'
            },
            {
              label: 'Money in this week',
              value: money(t.moneyInWeekCents),
              note: 'Cars picked up'
            },
            {
              label: 'Calls answered this week',
              value: t.callsAnsweredWeek,
              note: 'Inbound calls with an outcome'
            }
          ]}
        />
      </div>
      <div className='grid min-w-0 gap-4 lg:grid-cols-2'>
        <section
          aria-labelledby='needs-you'
          className='bg-card min-w-0 rounded-[var(--radius-card)] border p-4 sm:p-5'
        >
          <h2 id='needs-you' className='text-base font-medium'>
            Needs you
          </h2>
          {today.needsYou.length ? (
            <ul className='mt-3 divide-y'>
              {today.needsYou.map((item) => (
                <li key={`${item.kind}-${item.label}`}>
                  <Link
                    href={item.href}
                    className='hover:bg-muted focus-visible:ring-ring -mx-2 flex min-h-11 flex-col justify-center gap-0.5 rounded-md px-2 py-2 focus-visible:ring-2 focus-visible:outline-none'
                  >
                    <span className='text-sm font-medium'>{item.label}</span>
                    <span className='text-muted-foreground text-xs'>{item.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-muted-foreground mt-3 text-sm'>
              Nothing is waiting on you right now.
            </p>
          )}
        </section>
        <section
          aria-labelledby='running'
          className='bg-card min-w-0 rounded-[var(--radius-card)] border p-4 sm:p-5'
        >
          <h2 id='running' className='text-base font-medium'>
            Running without you
          </h2>
          {today.runningWithoutYou.length ? (
            <ul className='mt-3 divide-y'>
              {today.runningWithoutYou.map((item) => (
                <li key={item.label} className='flex flex-col gap-0.5 py-2'>
                  <span className='text-sm font-medium'>{item.label}</span>
                  <span className='text-muted-foreground text-xs'>{item.detail}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-muted-foreground mt-3 text-sm'>
              Nothing is scheduled to run on its own yet.
            </p>
          )}
        </section>
      </div>
      {t.carsInShop + t.newLeads + t.quotesWaiting === 0 && today.needsYou.length === 0 ? (
        <ShopEmpty
          title='Nothing to show yet'
          description='Cars in the shop, drop-offs, new leads and quotes waiting will appear here as soon as the shop has jobs.'
        />
      ) : null}
    </ShopPage>
  );
}
