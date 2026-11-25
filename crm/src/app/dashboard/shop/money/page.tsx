import { DisabledAction } from '@/components/shop/disabled-action';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { StatTiles } from '@/components/layout/stat-tiles';
import { getMoney } from '@/server/shop';
import { money, paymentLabel, when } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function MoneyPage() {
  const ctx = await shopContext();
  const { moneyIn, totals } = await getMoney(ctx);
  return (
    <ShopPage ctx={ctx} title='Money in and out' description='What came in, and what went out.'>
      <StatTiles
        label='Money in'
        tiles={[
          { label: 'This week', value: money(totals.weekInCents), key: true },
          { label: 'This month', value: money(totals.monthInCents) },
          { label: 'All recorded', value: money(totals.allInCents) }
        ]}
      />
      <section aria-labelledby='in' className='grid gap-3'>
        <h2 id='in' className='text-base font-medium'>
          Money in
        </h2>
        {moneyIn.length === 0 ? (
          <ShopEmpty
            title='No money recorded yet'
            description='Each car that is picked up will be listed here with what it brought in.'
          />
        ) : (
          <ul
            className='bg-card divide-y rounded-[var(--radius-card)] border'
            data-testid='money-in'
          >
            {moneyIn.slice(0, 50).map((m) => (
              <li
                key={m.id}
                className='flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4'
              >
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium'>{m.title}</p>
                  <p className='text-muted-foreground text-xs'>{m.customerName ?? 'No customer'}</p>
                </div>
                <p className='text-muted-foreground text-xs'>
                  {paymentLabel({ paymentType: m.paymentType, insurer: null }) ??
                    'Payment type not set'}
                </p>
                <p className='text-muted-foreground text-xs'>{when(m.wonAt)}</p>
                <p className='text-sm font-medium tabular-nums'>{money(m.amountCents)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby='out' className='grid gap-3'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <h2 id='out' className='text-base font-medium'>
            Money out
          </h2>
          <DisabledAction id='add-expense' note='Expenses turn on when the shop connects its books'>
            Add expense
          </DisabledAction>
        </div>
        <ShopEmpty
          title='No expenses recorded yet'
          description='Parts, paint and supplies will be listed here once expenses are connected. Nothing is estimated in the meantime.'
        />
      </section>
    </ShopPage>
  );
}
