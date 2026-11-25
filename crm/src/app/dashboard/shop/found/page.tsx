import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { Badge } from '@/components/ui/badge';
import { getGetFound } from '@/server/shop';
import { shopContext } from '../_lib/context';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  planned: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
  needs_attention: 'Needs attention'
};

export default async function FoundPage() {
  const ctx = await shopContext();
  const { listings, posts } = await getGetFound(ctx);
  return (
    <ShopPage
      ctx={ctx}
      title='Get found'
      description='Where customers look for a body shop, and whether the shop shows up.'
    >
      <section aria-labelledby='listings' className='grid gap-3'>
        <h2 id='listings' className='text-base font-medium'>
          Listings checklist
        </h2>
        {listings.length === 0 ? (
          <ShopEmpty
            title='No listings tracked yet'
            description='Google, Apple, Yelp and the AI assistants will be checked off here as each one is set up.'
          />
        ) : (
          <ul
            className='bg-card divide-y rounded-[var(--radius-card)] border'
            aria-label='Listings'
          >
            {listings.map((l) => (
              <li
                key={l.id}
                className='flex flex-wrap items-center justify-between gap-2 p-4'
                data-testid='listing'
              >
                <span className='text-sm font-medium'>{l.title}</span>
                <Badge variant={l.status === 'done' ? 'default' : 'outline'}>
                  {STATUS[l.status] ?? l.status}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby='posts' className='grid gap-3'>
        <h2 id='posts' className='text-base font-medium'>
          Post drafts
        </h2>
        {posts.length === 0 ? (
          <ShopEmpty
            title='No post drafts yet'
            description='Drafts for social posts will wait here for your OK. Nothing is posted for you.'
          />
        ) : (
          <ul className='grid gap-3' aria-label='Post drafts'>
            {posts.map((p) => (
              <li
                key={p.id}
                className='bg-card rounded-[var(--radius-card)] border p-4'
                data-testid='post-draft'
              >
                <p className='text-muted-foreground text-xs'>{p.title}</p>
                <p className='mt-1 text-sm'>{p.text}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ShopPage>
  );
}
