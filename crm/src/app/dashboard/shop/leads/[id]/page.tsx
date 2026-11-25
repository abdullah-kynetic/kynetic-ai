import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { StatusPill } from '@/components/ui/status-pill';
import { AppError } from '@/server/errors';
import { getShopLeadDetail, sourceLabel } from '@/server/shop';
import { money, when } from '../../_lib/format';
import { shopContext } from '../../_lib/context';

export const dynamic = 'force-dynamic';

export default async function LeadPage({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await shopContext();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let lead;
  try {
    lead = await getShopLeadDetail(ctx, id);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  return (
    <ShopPage
      ctx={ctx}
      title={lead.name}
      description={[sourceLabel(lead.source), lead.phone].filter(Boolean).join(' · ')}
      actions={
        <Link
          href='/dashboard/shop/leads'
          className='text-primary-text inline-flex min-h-11 items-center text-sm underline underline-offset-4'
        >
          All leads
        </Link>
      }
    >
      <section
        aria-labelledby='summary'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='summary' className='text-base font-medium'>
          Summary
        </h2>
        <p className='mt-2 text-sm'>{lead.summary ?? 'No summary yet.'}</p>
        {lead.jobs.length ? (
          <ul className='mt-3 flex flex-col gap-2'>
            {lead.jobs.map((job) => (
              <li key={job.id} className='flex flex-wrap items-center gap-2 text-sm'>
                <StatusPill tone='attention'>{job.stageName}</StatusPill>
                <span>{job.vehicleLabel || job.title}</span>
                {job.amountCents > 0 ? (
                  <span className='text-muted-foreground'>{money(job.amountCents)}</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section
        aria-labelledby='conversation'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='conversation' className='text-base font-medium'>
          Conversation
        </h2>
        {lead.conversation.length ? (
          <ol className='mt-3 flex flex-col gap-3'>
            {lead.conversation.map((item) => (
              <li
                key={item.id}
                className={`flex max-w-[34rem] flex-col gap-1 rounded-lg border p-3 text-sm ${item.direction === 'inbound' ? 'self-start' : 'bg-muted self-end'}`}
              >
                <span className='text-muted-foreground text-xs'>
                  {item.kind === 'call' ? 'Call' : 'Text'} ·{' '}
                  {item.direction === 'inbound' ? 'from the customer' : 'from the shop'} ·{' '}
                  {when(item.at)}
                  {item.detail ? ` · ${item.detail}` : ''}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className='text-muted-foreground mt-2 text-sm'>
            No calls or texts with this lead yet.
          </p>
        )}
      </section>
      <section aria-labelledby='photos' className='min-w-0'>
        <h2 id='photos' className='mb-2 text-base font-medium'>
          Photos
        </h2>
        <ShopEmpty
          title='No photos yet'
          description='Damage photos sent by the customer will appear here once photo storage is connected.'
        />
      </section>
    </ShopPage>
  );
}
