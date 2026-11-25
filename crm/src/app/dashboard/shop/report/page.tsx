import { DisabledAction } from '@/components/shop/disabled-action';
import { ShopPage } from '@/components/shop/shop-page';
import { WeekBars } from '@/components/shop/week-bars';
import { StatTiles } from '@/components/layout/stat-tiles';
import { getQuotes, getWeeklyEmailControl, getWeeklyReport } from '@/server/shop';
import { day, money, plural } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function ReportPage() {
  const ctx = await shopContext();
  const [report, { closeRate }, email] = await Promise.all([
    getWeeklyReport(ctx),
    getQuotes(ctx),
    getWeeklyEmailControl(ctx)
  ]);
  const w = report.current;
  const split = w.insurance.cars + w.outOfPocket.cars + w.unspecifiedCars;
  return (
    <ShopPage
      ctx={ctx}
      title='Weekly report'
      description={`The week of ${day(w.weekStart, report.timeZone)} in cars and money.`}
    >
      <div className='grid gap-3 sm:gap-4'>
        <StatTiles
          label='This week'
          tiles={[
            { label: 'Cars done', value: w.carsDone, key: true, note: 'Picked up this week' },
            { label: 'Money in', value: money(w.moneyInCents), note: 'From cars picked up' },
            {
              label: 'Average ticket',
              value: w.avgTicketCents === null ? 'None yet' : money(w.avgTicketCents),
              note: 'Money in per car done'
            }
          ]}
        />
        <StatTiles
          label='Calls and quotes'
          tiles={[
            {
              label: 'Calls answered',
              value: w.callsAnswered,
              note: 'Inbound calls with an outcome'
            },
            {
              label: 'Quotes sent',
              value: w.quotesSent,
              note: 'New jobs this week that were quoted'
            },
            {
              label: 'Close rate',
              value: closeRate.rate === null ? 'None yet' : `${Math.round(closeRate.rate * 100)}%`,
              note: `Won of won, lost and still out, last ${closeRate.windowDays} days`
            }
          ]}
        />
      </div>
      <section
        aria-labelledby='split'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='split' className='text-base font-medium'>
          Insurance and out-of-pocket
        </h2>
        {split === 0 ? (
          <p className='text-muted-foreground mt-2 text-sm'>No cars were picked up this week.</p>
        ) : (
          <dl className='mt-3 grid gap-3 sm:grid-cols-3' data-testid='payment-split'>
            <div>
              <dt className='text-muted-foreground text-sm'>Insurance</dt>
              <dd className='text-sm font-medium tabular-nums'>
                {plural(w.insurance.cars, 'car')} · {money(w.insurance.cents)}
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground text-sm'>Out-of-pocket</dt>
              <dd className='text-sm font-medium tabular-nums'>
                {plural(w.outOfPocket.cars, 'car')} · {money(w.outOfPocket.cents)}
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground text-sm'>Not marked</dt>
              <dd className='text-sm font-medium tabular-nums'>
                {plural(w.unspecifiedCars, 'car')}
              </dd>
            </div>
          </dl>
        )}
      </section>
      <section
        aria-labelledby='eight'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='eight' className='mb-3 text-base font-medium'>
          Last 8 weeks
        </h2>
        <WeekBars weeks={report.weeks} timeZone={report.timeZone} />
      </section>
      <section aria-labelledby='email' className='grid gap-2'>
        <h2 id='email' className='sr-only'>
          Weekly email
        </h2>
        {email.allowed ? (
          <p className='text-sm' data-testid='weekly-email-on'>
            {email.label}. {email.note}
          </p>
        ) : (
          <DisabledAction id='weekly-email' note={email.note}>
            {email.label}
          </DisabledAction>
        )}
      </section>
    </ShopPage>
  );
}
