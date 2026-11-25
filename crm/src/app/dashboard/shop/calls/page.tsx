import Link from 'next/link';
import { DisabledAction } from '@/components/shop/disabled-action';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { Button } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/status-pill';
import { getShopCalls, whereIsMyCar } from '@/server/shop';
import { when } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

const mins = (s: number | null) => (s == null ? '' : `${Math.max(1, Math.round(s / 60))} min`);

export default async function CallsPage({
  searchParams
}: {
  searchParams: Promise<{ job?: string }>;
}) {
  const ctx = await shopContext();
  const { job } = await searchParams;
  const view = await getShopCalls(ctx);
  const preview = job ? await whereIsMyCar(ctx, job) : null;
  const { rules } = view;
  return (
    <ShopPage ctx={ctx} title='Calls and texts' description='Every call and text in one place.'>
      <section
        aria-labelledby='where'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='where' className='text-base font-medium'>
          Where is my car?
        </h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          Pick a car to see what the receptionist would tell a customer who asks.
        </p>
        <form method='get' className='mt-3 flex flex-wrap items-end gap-3'>
          <div className='grid min-w-0 gap-1.5'>
            <label htmlFor='where-job' className='text-sm'>
              Car
            </label>
            <select
              id='where-job'
              name='job'
              defaultValue={job ?? ''}
              className='bg-card border-input focus-visible:ring-ring h-11 max-w-full min-w-48 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'
            >
              <option value=''>Choose a car</option>
              {view.jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </div>
          <Button type='submit' variant='outline'>
            Show reply
          </Button>
        </form>
        {preview ? (
          <div className='mt-3 grid gap-2' data-testid='where-preview'>
            <p className='bg-muted rounded-lg border p-3 text-sm'>{preview.reply}</p>
            <p className='text-muted-foreground text-xs'>
              Preview only. Read from the job&apos;s stage ({preview.stage}). Nothing is sent.
            </p>
          </div>
        ) : null}
      </section>

      <section
        aria-labelledby='rules'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <div className='flex flex-wrap items-center justify-between gap-2'>
          <h2 id='rules' className='text-base font-medium'>
            Receptionist rules
          </h2>
          <StatusPill tone={!rules.configured ? 'neutral' : rules.paused ? 'attention' : 'gain'}>
            {!rules.configured ? 'Not set up' : rules.paused ? 'Paused' : 'On'}
          </StatusPill>
        </div>
        {rules.configured ? (
          <dl className='mt-3 grid gap-3 text-sm'>
            <div>
              <dt className='text-muted-foreground'>Greeting</dt>
              <dd>{rules.greeting ?? 'Not set'}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Asks every caller</dt>
              <dd>{rules.questions.length ? rules.questions.join(' · ') : 'Not set'}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Booking</dt>
              <dd>{rules.bookingSummary ?? 'Not set'}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Calling window</dt>
              <dd>{rules.callWindow ?? 'Not set'}</dd>
            </div>
          </dl>
        ) : (
          <p className='text-muted-foreground mt-2 text-sm'>
            The receptionist has not been set up for this shop yet.
          </p>
        )}
        <div className='mt-4'>
          <DisabledAction id='edit-rules'>Change the rules</DisabledAction>
        </div>
      </section>

      <div className='grid min-w-0 gap-4 lg:grid-cols-2'>
        <section
          aria-labelledby='call-log'
          className='bg-card min-w-0 rounded-[var(--radius-card)] border p-4 sm:p-5'
        >
          <h2 id='call-log' className='text-base font-medium'>
            Call log
          </h2>
          {view.calls.length ? (
            <ul className='mt-3 divide-y'>
              {view.calls.map((c) => (
                <li key={c.id} className='flex flex-col gap-1 py-3'>
                  <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                    {c.contactId ? (
                      <Link
                        href={`/dashboard/shop/leads/${c.contactId}`}
                        className='text-primary-text text-sm font-medium underline underline-offset-4'
                      >
                        {c.name}
                      </Link>
                    ) : (
                      <span className='text-sm font-medium'>{c.name}</span>
                    )}
                    <StatusPill tone='neutral'>
                      {c.direction === 'inbound' ? 'Inbound' : 'Outbound'}
                    </StatusPill>
                    {c.outcome ? (
                      <span className='text-muted-foreground text-xs'>
                        {c.outcome.replaceAll('_', ' ')}
                      </span>
                    ) : null}
                    <span className='text-muted-foreground ml-auto text-xs'>
                      {when(c.startedAt)} {mins(c.durationS)}
                    </span>
                  </span>
                  {c.summary ? (
                    <span className='text-muted-foreground text-sm'>{c.summary}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className='mt-3'>
              <ShopEmpty
                title='No calls yet'
                description='Calls the receptionist answers will appear here with a short summary.'
              />
            </div>
          )}
        </section>
        <section
          aria-labelledby='text-log'
          className='bg-card min-w-0 rounded-[var(--radius-card)] border p-4 sm:p-5'
        >
          <h2 id='text-log' className='text-base font-medium'>
            Text log
          </h2>
          {view.texts.length ? (
            <ul className='mt-3 divide-y'>
              {view.texts.map((m) => (
                <li key={m.id} className='flex flex-col gap-1 py-3'>
                  <span className='flex flex-wrap items-center gap-x-2 gap-y-1'>
                    <span className='text-sm font-medium'>{m.name}</span>
                    <StatusPill tone='neutral'>
                      {m.direction === 'inbound' ? 'Received' : 'Sent'}
                    </StatusPill>
                    <span className='text-muted-foreground ml-auto text-xs'>{when(m.at)}</span>
                  </span>
                  <span className='text-muted-foreground text-sm'>{m.body}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className='mt-3'>
              <ShopEmpty
                title='No texts yet'
                description='Texts sent and received will appear here.'
              />
            </div>
          )}
        </section>
      </div>
    </ShopPage>
  );
}
