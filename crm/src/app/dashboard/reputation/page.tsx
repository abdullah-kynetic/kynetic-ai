import Link from 'next/link';
import { headers } from 'next/headers';
import { StatTiles } from '@/components/layout/stat-tiles';
import { NoAccess } from '@/components/ui/states';
import { contactsActorScope } from '@/server/contacts';
import { AppError } from '@/server/errors';
import { ForbiddenError } from '@/server/auth';
import { listReferrals } from '@/server/referrals';
import { reviewSummary } from '@/server/reviews';
import { RatingTrend } from '../reviews/rating-trend';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Reputation' };

const isGated = (error: unknown) =>
  (error instanceof AppError && (error.code === 'MODULE_DISABLED' || error.code === 'FORBIDDEN')) ||
  error instanceof ForbiddenError;

export default async function ReputationOverviewPage() {
  const scope = await contactsActorScope(await headers());
  if (!scope)
    return (
      <NoAccess
        title='Reputation is not available'
        description='Sign in to a client account to see your reviews.'
      />
    );
  let reviews: Awaited<ReturnType<typeof reviewSummary>> | null = null;
  try {
    reviews = await reviewSummary(scope.ctx, { range: '12m' });
  } catch (error) {
    if (!isGated(error) && !(error instanceof Error && error.name === 'ModuleDisabledError'))
      throw error;
  }
  let referrals: Awaited<ReturnType<typeof listReferrals>> | null = null;
  try {
    referrals = await listReferrals(scope.ctx);
  } catch (error) {
    if (!isGated(error) && !(error instanceof Error && error.name === 'ModuleDisabledError'))
      throw error;
  }
  if (!reviews && !referrals)
    return (
      <NoAccess
        title='Reputation is not part of your plan'
        description='Ask your Kynetic contact about adding review tracking.'
      />
    );
  return (
    <div className='space-y-6'>
      <StatTiles
        label='Reputation in numbers'
        tiles={[
          {
            label: 'Rating',
            value: reviews?.rating == null ? '—' : reviews.rating.toFixed(1),
            note: reviews?.rating == null ? 'No rating yet' : 'Across your review sources'
          },
          {
            label: 'Total reviews',
            value: reviews ? reviews.totalReviews.toLocaleString() : '—'
          },
          {
            label: 'New this month',
            value: reviews ? reviews.newThisMonth.toLocaleString() : '—',
            note: reviews ? `${reviews.requestsTotal} requests sent` : undefined
          },
          {
            label: 'Referrals',
            value: referrals ? String(referrals.kpis.thisMonth) : '—',
            note: referrals
              ? referrals.kpis.conversion90 == null
                ? 'Referred this month'
                : `Referred this month, ${referrals.kpis.conversion90}% won`
              : 'Not in your plan'
          }
        ]}
      />
      {reviews && reviews.totalReviews === 0 && (
        <section className='bg-card space-y-2 rounded-xl border p-6'>
          <h2 className='font-semibold'>No reviews tracked yet</h2>
          <p className='text-muted-foreground text-sm'>
            Ratings from your Google and other review profiles appear here once they are connected.
          </p>
        </section>
      )}
      {reviews && (
        <section aria-label='Rating trend' className='space-y-2'>
          <h2 className='font-medium'>Rating over the last 12 months</h2>
          <RatingTrend rows={reviews.trend} sources={reviews.sources} />
        </section>
      )}
      <div className='flex flex-wrap gap-4 text-sm'>
        <Link className='text-primary underline' href='/dashboard/reputation/reviews'>
          Open reviews
        </Link>
        <Link className='text-primary underline' href='/dashboard/reputation/referrals'>
          Open referrals
        </Link>
        <Link className='text-primary underline' href='/dashboard/reputation/presence'>
          Open online presence
        </Link>
      </div>
    </div>
  );
}
