import { DisabledAction } from '@/components/shop/disabled-action';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { getInsurance } from '@/server/shop';
import { day, money, plural } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

export default async function InsurancePage() {
  const ctx = await shopContext();
  const { waiting, supplements } = await getInsurance(ctx);
  return (
    <ShopPage ctx={ctx} title='Insurance' description='Cars waiting on the insurance company.'>
      <section aria-labelledby='waiting' className='grid gap-3'>
        <h2 id='waiting' className='text-base font-medium'>
          Waiting on insurance
        </h2>
        {waiting.length === 0 ? (
          <ShopEmpty
            title='Nothing waiting on insurance'
            description='Cars waiting on an adjuster or a supplement will appear here.'
          />
        ) : (
          <ul className='bg-card divide-y rounded-[var(--radius-card)] border'>
            {waiting.map((j) => (
              <li
                key={j.id}
                className='flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4'
                data-testid='insurance-row'
              >
                <div className='min-w-0 flex-1'>
                  <p className='text-sm font-medium'>{j.vehicleLabel || j.title}</p>
                  <p className='text-muted-foreground text-xs'>{j.customerName ?? 'No customer'}</p>
                </div>
                <p className='text-sm'>{j.insurer ?? 'Insurer not set'}</p>
                <p className='text-muted-foreground text-sm'>
                  {j.claimNumber ? `Claim ${j.claimNumber}` : 'No claim number yet'}
                </p>
                <p className='text-sm tabular-nums'>{money(j.amountCents)}</p>
                <p className='text-muted-foreground text-xs'>
                  Waiting {plural(j.waitingDays, 'day')} since {day(j.updatedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby='supplements' className='grid gap-3'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <h2 id='supplements' className='text-base font-medium'>
            Supplements
          </h2>
          <DisabledAction
            id='add-supplement'
            note='Supplement records turn on when the shop connects its estimating system'
          >
            Add supplement
          </DisabledAction>
        </div>
        {supplements.length === 0 ? (
          <ShopEmpty
            title='No supplements yet'
            description='When the insurer is asked for more money on a job, each request will be listed here with its status.'
          />
        ) : null}
      </section>
    </ShopPage>
  );
}
