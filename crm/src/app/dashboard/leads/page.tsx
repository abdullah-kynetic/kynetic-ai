import Link from 'next/link';
import { headers } from 'next/headers';
import { StatTiles } from '@/components/layout/stat-tiles';
import { NoAccess } from '@/components/ui/states';
import { contactsActorScope } from '@/server/contacts';
import { listStagesWithCounts } from '@/server/deals';
import { AppError } from '@/server/errors';
import { CountChart } from '../metrics-charts';
import { loadAreaMetrics, percentLabel } from '../area-data';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Leads' };

export default async function LeadsOverviewPage() {
  const data = await loadAreaMetrics();
  if (!data)
    return (
      <NoAccess
        title='Leads are not available'
        description='Sign in to a client account to see your leads.'
      />
    );
  const { metrics, range } = data;
  const scope = await contactsActorScope(await headers());
  let stages: { id: string; name: string; dealCount: number }[] | null = null;
  try {
    stages = scope ? await listStagesWithCounts(scope.ctx) : null;
  } catch (error) {
    if (!(error instanceof AppError && error.code === 'MODULE_DISABLED')) throw error;
  }
  const openDeals = (stages ?? []).reduce((sum, s) => sum + s.dealCount, 0);
  return (
    <div className='space-y-6'>
      <p className='text-muted-foreground text-sm'>
        Last 30 days, {range.from} to {range.to}.
      </p>
      <StatTiles
        label='Leads in numbers'
        tiles={[
          { label: 'New leads', value: String(metrics.totals.leads), note: 'Last 30 days' },
          {
            label: 'Reached',
            value: String(metrics.totals.contactsReached),
            note: 'Contacted by phone'
          },
          {
            label: 'Booked',
            value: String(metrics.totals.estimatesBooked),
            note: percentLabel(metrics.totals.bookingRate) + ' booking rate'
          },
          {
            label: 'Deals in pipeline',
            value: stages ? String(openDeals) : '—',
            note: stages ? `Across ${stages.length} stages` : 'Pipeline is not in your plan'
          }
        ]}
      />
      {metrics.totals.leads === 0 && (
        <section className='bg-card space-y-2 rounded-xl border p-6'>
          <h2 className='font-semibold'>No leads in the last 30 days</h2>
          <p className='text-muted-foreground text-sm'>
            New leads from your website, calls and bookings appear here as they arrive. You can also
            add one by hand or import a list.
          </p>
          <div className='flex gap-4 text-sm'>
            <Link className='text-primary underline' href='/dashboard/leads/contacts'>
              Open contacts
            </Link>
            <Link className='text-primary underline' href='/dashboard/leads/import'>
              Import leads
            </Link>
          </div>
        </section>
      )}
      <div className='grid min-w-0 gap-4 lg:grid-cols-2'>
        <CountChart
          name='Lead sources'
          ranked
          empty='No leads in this range.'
          rows={metrics.sources.map((s) => ({ label: s.source, value: s.leads }))}
        />
        {stages ? (
          <CountChart
            name='Pipeline by stage'
            empty='No deals in the pipeline yet.'
            rows={stages.map((s) => ({ label: s.name, value: s.dealCount }))}
          />
        ) : null}
        <section
          aria-label='Recent lead activity'
          className='bg-card min-w-0 rounded-xl p-4 ring-1 ring-foreground/10 lg:col-span-2'
        >
          <h2 className='font-medium'>Recent activity</h2>
          {metrics.activity.length ? (
            <ul className='mt-3 divide-y text-sm'>
              {metrics.activity.map((item) => (
                <li key={item.id} className='py-2'>
                  {item.summary}
                  <span className='text-muted-foreground block text-xs'>
                    {item.type} · {new Date(item.occurredAt).toISOString().slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className='text-muted-foreground mt-3 text-sm'>No recent activity.</p>
          )}
          <Link
            className='text-primary mt-3 inline-block text-sm underline'
            href='/dashboard/leads/contacts'
          >
            See all contacts
          </Link>
        </section>
      </div>
    </div>
  );
}
