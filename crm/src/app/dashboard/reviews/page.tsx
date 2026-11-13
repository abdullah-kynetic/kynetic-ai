import PageContainer from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/states';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { ForbiddenError } from '@/server/auth';
import { ModuleDisabledError } from '@/server/modules';
import {
  resolveReviewTrendRange,
  reviewSummary,
  REVIEW_TREND_RANGES,
  type ReviewTrendRange
} from '@/server/reviews';
import { loadShellContext } from '@/server/shell';
import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { RatingTrend } from './rating-trend';
import { RequestReview } from './request-review';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reviews', robots: { index: false, follow: false } };

const dateLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC'
  }).format(new Date(iso));

const timeLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC'
  }).format(new Date(iso));

type SearchParams = { range?: string };

export default async function ReviewsPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const [query, cookieStore, requestHeaders] = await Promise.all([
    searchParams,
    cookies(),
    headers()
  ]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  const tenant = shell.tenant;
  if (!tenant) {
    return (
      <PageContainer pageTitle='Reviews' access={false}>
        {null}
      </PageContainer>
    );
  }
  const ctx = { tenantId: tenant.id, userId: shell.user.id, role: shell.role };
  const range: ReviewTrendRange = resolveReviewTrendRange(query.range);

  let data;
  try {
    data = await reviewSummary(ctx, { range });
  } catch (err) {
    // OPM is the module that owns reviews; a direct visit with it off reads as no access.
    if (err instanceof ModuleDisabledError || err instanceof ForbiddenError) {
      return (
        <PageContainer pageTitle='Reviews' access={false}>
          {null}
        </PageContainer>
      );
    }
    throw err;
  }

  const kpis = [
    ['Rating', data.rating == null ? 'No rating yet' : data.rating.toFixed(1)],
    ['Total reviews', data.totalReviews.toLocaleString()],
    ['New this month', data.newThisMonth.toLocaleString()],
    ['Requests', data.requestsTotal.toLocaleString()]
  ] as const;

  return (
    <PageContainer
      pageTitle='Reviews'
      pageDescription='Your review rating, recent snapshots and requests you have asked us to send.'
    >
      <p role='status' className='rounded border p-3 text-sm'>
        Review requests go out once live messaging is on.
      </p>

      <div className='mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
        {kpis.map(([label, value]) => (
          <div key={label} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
            <p className='text-muted-foreground text-sm'>{label}</p>
            <p className='mt-2 text-2xl font-semibold'>{value}</p>
          </div>
        ))}
      </div>

      <div className='mt-4 flex flex-wrap items-center justify-between gap-3'>
        <nav aria-label='Rating trend window' className='flex flex-wrap gap-2'>
          {REVIEW_TREND_RANGES.map((option) => (
            <Link
              key={option}
              href={`/dashboard/reviews?range=${option}`}
              aria-current={range === option ? 'true' : undefined}
              className={
                range === option
                  ? 'bg-primary text-primary-foreground inline-flex h-11 items-center rounded-full px-4 text-sm font-medium'
                  : 'border-input hover:bg-muted inline-flex h-11 items-center rounded-full border px-4 text-sm'
              }
            >
              {option === '90d' ? 'Last 90 days' : 'Last 12 months'}
            </Link>
          ))}
        </nav>
        <RequestReview contacts={data.contactOptions} />
      </div>

      <div className='mt-4'>
        <RatingTrend rows={data.trend} sources={data.sources} />
      </div>

      <section aria-label='Review snapshots' className='mt-4'>
        <h2 className='mb-2 font-medium'>Snapshots</h2>
        {data.snapshots.length ? (
          <>
            <div className='hidden md:block'>
              <Table>
                <caption className='sr-only'>Review snapshots, newest first</caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope='col'>Date</TableHead>
                    <TableHead scope='col'>Source</TableHead>
                    <TableHead scope='col' className='text-right'>
                      Reviews
                    </TableHead>
                    <TableHead scope='col' className='text-right'>
                      Rating
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.snapshots.map((snapshot) => (
                    <TableRow key={snapshot.id} className='h-11'>
                      <TableCell className='whitespace-nowrap'>
                        {dateLabel(snapshot.capturedOn)}
                      </TableCell>
                      <TableCell>
                        <span className='flex flex-wrap items-center gap-2'>
                          {snapshot.source}
                          {snapshot.demo && <Badge variant='neutral'>Demo</Badge>}
                        </span>
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {snapshot.reviewCount.toLocaleString()}
                      </TableCell>
                      <TableCell className='text-right tabular-nums'>
                        {snapshot.averageRating == null ? '–' : snapshot.averageRating.toFixed(1)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <ul className='flex flex-col gap-2 md:hidden'>
              {data.snapshots.map((snapshot) => (
                <li key={snapshot.id} className='bg-card rounded-lg border p-3 text-sm'>
                  <div className='flex items-start justify-between gap-2'>
                    <span className='font-medium'>{snapshot.source}</span>
                    <span className='flex items-center gap-2'>
                      {snapshot.demo && <Badge variant='neutral'>Demo</Badge>}
                      <span className='tabular-nums'>
                        {snapshot.averageRating == null ? '–' : snapshot.averageRating.toFixed(1)}
                      </span>
                    </span>
                  </div>
                  <p className='text-muted-foreground mt-1'>
                    {dateLabel(snapshot.capturedOn)} · {snapshot.reviewCount.toLocaleString()}{' '}
                    {snapshot.reviewCount === 1 ? 'review' : 'reviews'}
                  </p>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <EmptyState
            title='No snapshots yet'
            description='Kynetic captures your rating and review count each month. They will appear here.'
          />
        )}
      </section>

      <section aria-label='Review requests' className='mt-6'>
        <h2 className='mb-2 font-medium'>Requests</h2>
        {data.requests.length ? (
          <Table>
            <caption className='sr-only'>Review requests, newest first</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope='col'>Contact</TableHead>
                <TableHead scope='col'>Channel</TableHead>
                <TableHead scope='col'>Status</TableHead>
                <TableHead scope='col'>Requested</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.requests.map((request) => (
                <TableRow key={request.id} className='h-11'>
                  <TableCell>
                    <Link
                      href={`/dashboard/contacts/${request.contactId}`}
                      className='text-primary-text font-medium underline-offset-4 hover:underline'
                    >
                      {request.contactName}
                    </Link>
                  </TableCell>
                  <TableCell className='capitalize'>
                    {request.channel === 'sms' ? 'Text' : 'Email'}
                  </TableCell>
                  <TableCell>
                    <Badge variant={request.status === 'queued' ? 'info' : 'neutral'}>
                      {request.status}
                    </Badge>
                  </TableCell>
                  <TableCell className='whitespace-nowrap'>
                    {timeLabel(request.requestedAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title='No review requests yet'
            description='Use “Request a review” to queue one for a happy customer.'
          />
        )}
      </section>
    </PageContainer>
  );
}
