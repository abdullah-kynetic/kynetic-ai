import Link from 'next/link';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { getTeam, type JobCard } from '@/server/shop';
import { money, plural } from '../_lib/format';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

const Car = ({ j }: { j: JobCard }) => (
  <li className='flex flex-wrap items-baseline justify-between gap-x-3 py-2'>
    <span className='text-sm font-medium'>{j.vehicleLabel || j.title}</span>
    <span className='text-muted-foreground text-xs'>
      {j.stageName} · {money(j.amountCents)}
    </span>
  </li>
);

export default async function TeamPage() {
  const ctx = await shopContext();
  const { owners, paintQueue } = await getTeam(ctx);
  const withJobs = owners.filter((o) => o.openJobs.length > 0);
  return (
    <ShopPage
      ctx={ctx}
      title='Team'
      description='Who has which cars, and what is in the paint queue.'
    >
      <section
        aria-labelledby='paint'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='paint' className='text-base font-medium'>
          Paint queue
        </h2>
        <p className='text-muted-foreground mt-1 text-sm'>
          Cars in the In repair and paint stage, oldest first.
        </p>
        {paintQueue.length === 0 ? (
          <p className='text-muted-foreground mt-3 text-sm'>
            No cars in repair or paint right now.
          </p>
        ) : (
          <ol className='mt-3 divide-y' data-testid='paint-queue'>
            {[...paintQueue]
              .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
              .map((j) => (
                <li
                  key={j.id}
                  className='flex flex-wrap items-baseline justify-between gap-x-3 py-2'
                >
                  <span className='text-sm font-medium'>{j.vehicleLabel || j.title}</span>
                  <span className='text-muted-foreground text-xs'>
                    {j.customerName ?? 'No customer'}
                    {j.tech ? ` · Tech: ${j.tech}` : ''} · {plural(j.daysInShop, 'day')} in shop
                  </span>
                </li>
              ))}
          </ol>
        )}
      </section>
      {withJobs.length === 0 ? (
        <ShopEmpty
          title='No open jobs yet'
          description='Open jobs will be grouped here by the person who owns them.'
        />
      ) : (
        <div className='grid min-w-0 gap-4 lg:grid-cols-2'>
          {withJobs.map((o) => (
            <section
              key={o.ownerId ?? 'none'}
              aria-labelledby={`owner-${o.ownerId ?? 'none'}`}
              className='bg-card min-w-0 rounded-[var(--radius-card)] border p-4 sm:p-5'
              data-testid='team-owner'
            >
              <h2 id={`owner-${o.ownerId ?? 'none'}`} className='text-base font-medium'>
                {o.name}
              </h2>
              <p className='text-muted-foreground text-sm'>
                {plural(o.openJobs.length, 'open job')} · {money(o.totalCents)}
              </p>
              <ul className='mt-2 divide-y'>
                {o.openJobs.map((j) => (
                  <Car key={j.id} j={j} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <Link
        href='/dashboard/shop/jobs'
        className='text-primary-text inline-flex min-h-11 items-center text-sm underline underline-offset-4'
      >
        Open the jobs board
      </Link>
    </ShopPage>
  );
}
