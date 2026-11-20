import Link from 'next/link';
import { StatTiles } from '@/components/layout/stat-tiles';
import { FinanceMonthsChart } from '../agency/finance/chart';
import type { MoneyOverview } from '@/server/agency/money';

export const usd = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);

/** MRR, collected, outstanding and the six-month trend. */
export function MoneyDashboard({ data }: { data: MoneyOverview }) {
  const tiles = [
    {
      label: 'MRR',
      value: usd(data.mrrCents),
      note: `${data.recurringClients.length} recurring ${data.recurringClients.length === 1 ? 'client' : 'clients'}`
    },
    {
      label: 'Collected this month',
      value: usd(data.collectedCents),
      note: `Pacific ${data.month}, won deals and manual entries`
    },
    {
      label: 'Outstanding',
      value: usd(data.outstanding.totalCents),
      note: `${data.outstanding.invoices} unpaid ${data.outstanding.invoices === 1 ? 'invoice' : 'invoices'}`
    },
    {
      label: 'Net this month',
      value: usd(data.netCents),
      note: `After ${usd(data.expenseCents)} of expenses`
    }
  ];
  const empty =
    data.mrrCents === 0 &&
    data.collectedCents === 0 &&
    data.outstanding.totalCents === 0 &&
    data.trend.every((t) => t.revenueCents === 0 && t.expenseCents === 0);
  return (
    <div className='space-y-6'>
      <StatTiles label='Revenue in numbers' tiles={tiles} />
      {empty && (
        <section className='bg-card space-y-2 rounded-xl border p-6'>
          <h2 className='font-semibold'>No money recorded yet</h2>
          <p className='text-muted-foreground text-sm'>
            Save deal terms in Billing and record revenue or expenses in Finance. They appear here
            automatically.
          </p>
          <div className='flex gap-4 text-sm'>
            <Link className='text-primary underline' href='/admin/money/billing'>
              Open Billing
            </Link>
            <Link className='text-primary underline' href='/admin/money/finance'>
              Open Finance
            </Link>
          </div>
        </section>
      )}
      <section
        aria-label='Six-month revenue trend'
        className='bg-card rounded-[var(--radius-card)] border p-5'
      >
        <h2 className='mb-3 font-semibold'>Revenue and expenses, last six months</h2>
        <FinanceMonthsChart months={[...data.trend].reverse()} />
      </section>
      <div className='grid gap-6 lg:grid-cols-2'>
        <section
          aria-label='Outstanding invoices'
          className='bg-card space-y-3 rounded-[var(--radius-card)] border p-5'
        >
          <h2 className='font-semibold'>Outstanding</h2>
          <dl className='divide-y text-sm'>
            {[
              ['Open', data.outstanding.openCents],
              ['Past due', data.outstanding.pastDueCents],
              ['Drafts not sent', data.outstanding.draftCents]
            ].map(([label, cents]) => (
              <div key={label as string} className='flex justify-between py-2'>
                <dt>{label}</dt>
                <dd className='tabular-nums'>{usd(cents as number)}</dd>
              </div>
            ))}
          </dl>
          <Link className='text-primary text-sm underline' href='/admin/money/invoices'>
            See all invoices
          </Link>
        </section>
        <section
          aria-label='Recurring revenue by client'
          className='bg-card space-y-3 rounded-[var(--radius-card)] border p-5'
        >
          <h2 className='font-semibold'>Recurring revenue</h2>
          {data.recurringClients.length === 0 ? (
            <p className='text-muted-foreground text-sm'>
              No won deals have a monthly fee yet. Add one under Billing.
            </p>
          ) : (
            <ul className='divide-y text-sm'>
              {data.recurringClients.map((c) => (
                <li key={c.dealId} className='flex justify-between py-2'>
                  <span>{c.name}</span>
                  <span className='tabular-nums'>{usd(c.monthlyCents)} / month</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
