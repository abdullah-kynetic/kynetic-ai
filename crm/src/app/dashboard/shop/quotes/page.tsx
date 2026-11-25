import Link from 'next/link';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { Badge } from '@/components/ui/badge';
import { getFollowUps, getQuotes, type FollowUpRun } from '@/server/shop';
import { money, paymentLabel, plural, when } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  active: 'Waiting to go out',
  completed: 'All steps done',
  stopped_reply: 'Stopped: the customer replied',
  stopped_won: 'Stopped: the job was won',
  stopped_lost: 'Stopped: the job was lost',
  stopped_manual: 'Stopped by you'
};
const statusText = (run: FollowUpRun) =>
  run.stopReason
    ? `Stopped: ${run.stopReason.replace(/_/g, ' ')}`
    : (STATUS[run.status] ?? run.status);

const CHANNEL: Record<string, string> = { sms: 'Text', email: 'Email', call: 'Call' };
const delay = (m: number) =>
  m % 1440 === 0
    ? plural(m / 1440, 'day')
    : m % 60 === 0
      ? plural(m / 60, 'hour')
      : plural(m, 'minute');

function Tabs({ active }: { active: 'quotes' | 'followups' }) {
  const link = (key: string, label: string, on: boolean, href: string) => (
    <Link
      key={key}
      href={href}
      aria-current={on ? 'page' : undefined}
      className={`focus-visible:ring-ring inline-flex min-h-11 items-center rounded-full border px-4 text-sm focus-visible:ring-2 focus-visible:outline-none ${on ? 'bg-primary text-primary-foreground border-transparent' : 'bg-card hover:bg-muted'}`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label='Quotes sections' className='flex gap-2'>
      {link('q', 'Quotes out', active === 'quotes', '/dashboard/shop/quotes')}
      {link('f', 'Follow-ups', active === 'followups', '/dashboard/shop/quotes?tab=followups')}
    </nav>
  );
}

export default async function QuotesPage({
  searchParams
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const ctx = await shopContext();
  const tab = (await searchParams).tab === 'followups' ? 'followups' : 'quotes';
  return (
    <ShopPage
      ctx={ctx}
      title='Quotes'
      description='Estimates that are out, and which ones are closing.'
    >
      <Tabs active={tab} />
      {tab === 'quotes' ? <QuotesTab /> : <FollowUpsTab />}
    </ShopPage>
  );
}

async function QuotesTab() {
  const ctx = await shopContext();
  const { quotes, closeRate } = await getQuotes(ctx);
  const total = closeRate.won + closeRate.lost + closeRate.stillQuoted;
  return (
    <>
      <section
        aria-labelledby='close-rate'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='close-rate' className='text-muted-foreground text-sm'>
          Close rate, last {closeRate.windowDays} days
        </h2>
        {closeRate.rate === null ? (
          <p className='mt-1 text-sm'>No quotes in this period yet.</p>
        ) : (
          <>
            <p className='mt-1 text-3xl font-medium tabular-nums' data-testid='close-rate'>
              {Math.round(closeRate.rate * 100)}%
            </p>
            <p className='text-muted-foreground mt-1 text-sm'>
              {closeRate.won} won out of {plural(total, 'quote')} ({closeRate.lost} lost,{' '}
              {closeRate.stillQuoted} still out). Won divided by won, lost and still out.
            </p>
          </>
        )}
      </section>
      {quotes.length === 0 ? (
        <ShopEmpty
          title='No quotes out right now'
          description='Jobs in the Quoted stage will appear here with their age and amount.'
        />
      ) : (
        <ul
          className='bg-card divide-y rounded-[var(--radius-card)] border'
          aria-label='Quotes out'
        >
          {quotes.map((q) => (
            <li key={q.id} className='flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4'>
              <div className='min-w-0 flex-1'>
                <p className='text-sm font-medium'>{q.vehicleLabel || q.title}</p>
                <p className='text-muted-foreground text-xs'>{q.customerName ?? 'No customer'}</p>
              </div>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='text-sm font-medium tabular-nums'>{money(q.amountCents)}</span>
                {paymentLabel(q) ? <Badge variant='outline'>{paymentLabel(q)}</Badge> : null}
                <span className='text-muted-foreground text-xs'>
                  {q.ageDays === 0 ? 'Quoted today' : `${plural(q.ageDays, 'day')} old`}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

async function FollowUpsTab() {
  const ctx = await shopContext();
  const { runs } = await getFollowUps(ctx);
  if (runs.length === 0)
    return (
      <ShopEmpty
        title='No follow-ups yet'
        description='When a job is quoted, its follow-up steps, replies and stops will be listed here.'
      />
    );
  return (
    <>
      <p className='text-muted-foreground text-sm'>
        Follow-ups stop on their own when the customer replies or the job is won or lost. Nothing is
        sent until follow-ups are switched on.
      </p>
      <ul className='grid gap-3' aria-label='Follow-up runs'>
        {runs.map((r) => (
          <li
            key={r.id}
            className='bg-card rounded-[var(--radius-card)] border p-4'
            data-testid='follow-up-run'
          >
            <div className='flex flex-wrap items-baseline justify-between gap-2'>
              <p className='text-sm font-medium'>{r.customerName ?? 'Customer'}</p>
              <p className='text-muted-foreground text-xs'>
                {statusText(r)}
                {r.nextRunAt && r.status === 'active' ? ` · next ${when(r.nextRunAt)}` : ''}
              </p>
            </div>
            {r.dealTitle ? <p className='text-muted-foreground text-xs'>{r.dealTitle}</p> : null}
            <ol className='mt-3 grid gap-1.5'>
              {r.steps.map((s) => (
                <li key={s.position} className='flex items-center gap-2 text-sm'>
                  <Badge variant={s.state === 'sent' ? 'default' : 'outline'}>
                    {s.state === 'sent' ? 'Sent' : s.state === 'next' ? 'Next' : 'Pending'}
                  </Badge>
                  <span>
                    {CHANNEL[s.channel] ?? s.channel} after {delay(s.delayMinutes)}
                  </span>
                </li>
              ))}
            </ol>
            <p className='text-muted-foreground mt-2 text-xs'>
              {r.replied ? 'The customer replied.' : 'No reply yet.'}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
