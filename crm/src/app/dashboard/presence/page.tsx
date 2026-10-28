import PageContainer from '@/components/layout/page-container';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { listPresence } from '@/server/presence';
import { isModuleEnabled } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import { cookies, headers } from 'next/headers';
import { forbidden, redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function PresencePage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell) redirect('/sign-in');
  if (!shell.tenant) forbidden();
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  if (!(await isModuleEnabled(ctx, 'opm'))) forbidden();
  const { items, reviews } = await listPresence(ctx);
  return (
    <PageContainer pageTitle='Online Presence' pageDescription='Status of your business profile, reviews, listings and posts.'>
      <div className='grid gap-4 md:grid-cols-2'>
        <Card><CardHeader><CardTitle>Presence activity</CardTitle></CardHeader><CardContent>
          {items.length ? <ul className='space-y-3'>{items.map((item) => <li key={item.id}><span className='font-medium'>{item.title}</span><span className='text-muted-foreground'> · {item.status.replaceAll('_', ' ')}</span>{item.notes && <p className='text-sm'>{item.notes}</p>}</li>)}</ul> : <p>No activity recorded yet.</p>}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Review snapshots</CardTitle></CardHeader><CardContent>
          {reviews.length ? <ul className='space-y-3'>{reviews.map((review) => <li key={review.id}>{review.source}: {review.reviewCount} reviews{review.averageRating && ` · ${review.averageRating}/5`} <span className='text-muted-foreground'>({review.capturedOn})</span></li>)}</ul> : <p>No review snapshots yet.</p>}
        </CardContent></Card>
      </div>
    </PageContainer>
  );
}
