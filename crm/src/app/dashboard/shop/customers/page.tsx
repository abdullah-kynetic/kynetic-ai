import Link from 'next/link';
import { DisabledAction } from '@/components/shop/disabled-action';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { bringBackEmail, getCustomers } from '@/server/shop';
import { day, money, plural } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

const REVIEW: Record<string, string> = {
  not_requested: 'Not asked yet',
  requested: 'Asked for a review',
  reviewed: 'Left a review'
};

export default async function CustomersPage({
  searchParams
}: {
  searchParams: Promise<{ q?: string; bring?: string }>;
}) {
  const ctx = await shopContext();
  const { q, bring } = await searchParams;
  const { customers, businessName } = await getCustomers(ctx);
  const term = (q ?? '').trim().toLowerCase();
  const shown = term
    ? customers.filter((c) =>
        [c.name, c.phone ?? '', c.email ?? ''].some((v) => v.toLowerCase().includes(term))
      )
    : customers;
  const pickable = customers.filter((c) => c.pickedUp);
  const chosen = pickable.find((c) => c.id === bring);
  const email = chosen
    ? bringBackEmail({
        firstName: chosen.name.split(' ')[0]!,
        businessName,
        vehicle: chosen.lastJobLabel
      })
    : null;
  return (
    <ShopPage
      ctx={ctx}
      title='Customers'
      description='Everyone the shop has worked with, and what they have spent.'
    >
      <form method='get' role='search' className='flex flex-wrap items-end gap-3'>
        <div className='grid min-w-0 flex-1 gap-1.5 sm:max-w-sm'>
          <label htmlFor='customer-search' className='text-sm'>
            Search customers
          </label>
          <input
            id='customer-search'
            name='q'
            type='search'
            defaultValue={q ?? ''}
            placeholder='Name, phone or email'
            className='bg-card border-input focus-visible:ring-ring h-11 w-full rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'
          />
        </div>
        <Button type='submit' variant='outline'>
          Search
        </Button>
      </form>
      {shown.length === 0 ? (
        <ShopEmpty
          title={term ? 'No customers match that search' : 'No customers yet'}
          description={
            term
              ? 'Try part of the name, or the last four digits of the phone number.'
              : 'Customers appear here as soon as the shop has leads and jobs.'
          }
        />
      ) : (
        <ul className='bg-card divide-y rounded-[var(--radius-card)] border' aria-label='Customers'>
          {shown.map((c) => (
            <li
              key={c.id}
              className='flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-4'
              data-testid='customer-row'
            >
              <div className='min-w-0 flex-1'>
                <Link
                  href={`/dashboard/contacts/${c.id}`}
                  className='text-sm font-medium underline-offset-4 hover:underline'
                >
                  {c.name}
                </Link>
                <p className='text-muted-foreground text-xs'>
                  {c.lastJobLabel ? `Last job: ${c.lastJobLabel}` : 'No jobs yet'}
                  {c.lastJobAt ? ` · ${day(c.lastJobAt)}` : ''}
                </p>
              </div>
              <p className='text-muted-foreground text-xs'>{plural(c.jobs, 'job')}</p>
              <p className='text-sm font-medium tabular-nums'>{money(c.lifetimeCents)} spent</p>
              <Badge variant={c.reviewStatus === 'reviewed' ? 'default' : 'outline'}>
                {REVIEW[c.reviewStatus]}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <section
        aria-labelledby='bring-back'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='bring-back' className='text-base font-medium'>
          Bring back old customers
        </h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          Pick a past customer to see the email they would get. This is a preview. Nothing is sent.
        </p>
        <form method='get' className='mt-3 flex flex-wrap items-end gap-3'>
          <div className='grid min-w-0 gap-1.5'>
            <label htmlFor='bring-customer' className='text-sm'>
              Past customer
            </label>
            <select
              id='bring-customer'
              name='bring'
              defaultValue={bring ?? ''}
              className='bg-card border-input focus-visible:ring-ring h-11 max-w-full min-w-48 rounded-lg border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none'
            >
              <option value=''>Choose a customer</option>
              {pickable.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button type='submit' variant='outline'>
            Show email
          </Button>
        </form>
        {email ? (
          <div className='mt-3 grid gap-3' data-testid='bring-back-preview'>
            <div className='bg-muted rounded-lg border p-3'>
              <p className='text-sm font-medium'>Subject: {email.subject}</p>
              <pre className='mt-2 font-sans text-sm whitespace-pre-wrap'>{email.body}</pre>
            </div>
            <DisabledAction id='bring-back-send' note='Turns on when this is connected'>
              Send
            </DisabledAction>
          </div>
        ) : pickable.length === 0 ? (
          <p className='text-muted-foreground mt-3 text-sm'>
            No picked-up customers yet, so there is nobody to bring back.
          </p>
        ) : null}
      </section>
    </ShopPage>
  );
}
