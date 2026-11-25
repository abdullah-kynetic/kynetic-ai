import { DisabledAction } from '@/components/shop/disabled-action';
import { ShopPage } from '@/components/shop/shop-page';
import { getAwaySettings, getToday } from '@/server/shop';
import { money, plural } from '../_lib/format';
import { shopContext } from '../_lib/context';
import { AwayForm } from './away-form';

export const dynamic = 'force-dynamic';

export default async function AwayPage() {
  const ctx = await shopContext();
  const [settings, today] = await Promise.all([getAwaySettings(ctx), getToday(ctx)]);
  const t = today.tiles;
  const lines = [
    `${plural(t.carsInShop, 'car')} in the shop.`,
    `${plural(t.newLeads, 'new lead')} waiting for a quote.`,
    `${plural(t.quotesWaiting, 'quote')} out with customers.`,
    `${plural(t.callsAnsweredWeek, 'call')} answered this week.`,
    `${money(t.moneyInWeekCents)} in this week.`
  ];
  return (
    <ShopPage ctx={ctx} title='Away mode' description='Close the shop and keep the phones covered.'>
      <p
        className='bg-surface-sunken rounded-[var(--radius-control)] p-3 text-sm'
        data-testid='away-status'
      >
        {settings.enabled
          ? `Away mode is saved as on${settings.from && settings.until ? ` from ${settings.from} to ${settings.until}` : ''}. It is a setting only for now: the receptionist and texts behave as usual.`
          : 'Away mode is off.'}
      </p>
      <AwayForm saved={settings} />
      <section
        aria-labelledby='summary'
        className='bg-card max-w-xl rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='summary' className='text-base font-medium'>
          Daily summary preview
        </h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          This is what the summary would say today, from the shop&apos;s real numbers.
        </p>
        <ul className='mt-3 grid gap-1 text-sm' data-testid='summary-preview'>
          {lines.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <div className='mt-3'>
          <DisabledAction id='send-summary' note='Turns on when this is connected'>
            Send me this summary now
          </DisabledAction>
        </div>
      </section>
    </ShopPage>
  );
}
