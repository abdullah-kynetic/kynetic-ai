import { DisabledAction } from '@/components/shop/disabled-action';
import { ShopEmpty } from '@/components/shop/shop-empty';
import { ShopPage } from '@/components/shop/shop-page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getReviews } from '@/server/shop';
import { day } from '../_lib/format';
import { shopContext } from '../_lib/context';
import { approveReplyAction } from './actions';

export const dynamic = 'force-dynamic';

const STATUS: Record<string, string> = {
  queued: 'Waiting to send',
  sent: 'Asked',
  completed: 'Left a review',
  cancelled: 'Cancelled'
};

export default async function ReviewsPage() {
  const ctx = await shopContext();
  const view = await getReviews(ctx);
  return (
    <ShopPage
      ctx={ctx}
      title='Reviews'
      description='What customers say, and the replies waiting for your OK.'
    >
      <section
        aria-labelledby='rating'
        className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5'
      >
        <h2 id='rating' className='text-base font-medium'>
          Rating
        </h2>
        {view.rating === null ? (
          <p className='text-muted-foreground mt-2 text-sm'>
            No ratings recorded yet. They show here once review sites are connected.
          </p>
        ) : (
          <>
            <p className='mt-1 text-3xl font-medium tabular-nums' data-testid='rating'>
              {view.rating.toFixed(1)}
              <span className='text-muted-foreground ml-2 text-sm font-normal'>
                from {view.totalReviews} reviews
              </span>
            </p>
            <ul className='text-muted-foreground mt-2 grid gap-1 text-sm'>
              {view.sources.map((s) => (
                <li key={s.source}>
                  {s.source}: {s.averageRating?.toFixed(1) ?? 'no rating'} ({s.reviewCount} reviews,
                  as of {day(s.capturedOn)})
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section aria-labelledby='replies' className='grid gap-3'>
        <h2 id='replies' className='text-base font-medium'>
          Recent reviews and drafted replies
        </h2>
        <p className='text-muted-foreground text-sm'>
          Replies are drafted in your voice. Approving a reply marks it ready in the portal. It is
          not posted anywhere.
        </p>
        {view.replies.length === 0 ? (
          <ShopEmpty
            title='No reviews to answer'
            description='New reviews and their drafted replies will appear here once Google is connected.'
          />
        ) : (
          <ul className='grid gap-3' aria-label='Drafted replies'>
            {view.replies.map((r) => (
              <li
                key={r.id}
                className='bg-card rounded-[var(--radius-card)] border p-4'
                data-testid='review-reply'
              >
                <div className='flex flex-wrap items-baseline justify-between gap-2'>
                  <p className='text-sm font-medium'>
                    {r.reviewer}
                    <span className='text-muted-foreground font-normal'>
                      {' '}
                      · {r.rating} out of 5 · {r.source}
                    </span>
                  </p>
                  {r.approved ? <Badge>Approved</Badge> : <Badge variant='outline'>Draft</Badge>}
                </div>
                <p className='mt-2 text-sm'>&ldquo;{r.text}&rdquo;</p>
                <div className='bg-muted mt-3 rounded-lg border p-3'>
                  <p className='text-muted-foreground text-xs'>Drafted reply</p>
                  <p className='mt-1 text-sm'>{r.reply}</p>
                </div>
                {r.approved ? (
                  <p className='text-muted-foreground mt-2 text-xs'>
                    Approved in the portal. Not posted anywhere.
                  </p>
                ) : (
                  <form action={approveReplyAction} className='mt-3'>
                    <input type='hidden' name='id' value={r.id} />
                    <Button type='submit' variant='outline'>
                      Approve reply<span className='sr-only'> to {r.reviewer}</span>
                    </Button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section aria-labelledby='requests' className='grid gap-3'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <h2 id='requests' className='text-base font-medium'>
            Review requests
          </h2>
          <DisabledAction id='ask-reviews' note='Turns on when this is connected'>
            Ask customers for a review
          </DisabledAction>
        </div>
        <p className='text-muted-foreground text-sm' data-testid='review-wording'>
          Every customer gets the Google link. Nobody is skipped, and requests are never filtered by
          how happy someone seems or by star rating.
        </p>
        {view.requests.length === 0 ? (
          <ShopEmpty
            title='No review requests yet'
            description='Requests to customers whose cars were picked up will be listed here.'
          />
        ) : (
          <ul
            className='bg-card divide-y rounded-[var(--radius-card)] border'
            aria-label='Review requests'
          >
            {view.requests.map((r) => (
              <li key={r.id} className='flex flex-wrap items-center justify-between gap-2 p-4'>
                <span className='text-sm font-medium'>{r.customerName}</span>
                <span className='text-muted-foreground text-xs'>
                  {STATUS[r.status] ?? r.status} · {day(r.requestedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </ShopPage>
  );
}
