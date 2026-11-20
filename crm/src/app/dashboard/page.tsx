import { requireModule } from '@/server/modules';
import { StatTiles } from '@/components/layout/stat-tiles';
import { CountChart, DailyTrend } from './metrics-charts';
import { PortalPageContainer as PageContainer } from '@/components/layout/page-container';
import { SetupProgressCard } from '@/components/onboarding/setup-progress-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { loadSetupProgress } from '@/server/admin';
import { loadShellContext } from '@/server/shell';
import { getBusinessSettings } from '@/server/settings/business';
import { cookies, headers } from 'next/headers';
import {
  DASHBOARD_RANGE_NOTICE,
  getDashboardMetrics,
  getGuaranteeSettings,
  guaranteeProgress,
  presetRange,
  resolveDashboardRange
} from '@/server/metrics';

export const dynamic = 'force-dynamic';

const shortDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC'
  });

function rangeHref(from: string, to: string) {
  return `/dashboard?from=${from}&to=${to}`;
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const [cookieStore, requestHeaders, query] = await Promise.all([
    cookies(),
    headers(),
    searchParams
  ]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  // F-100: only the owner sees setup progress, and only until go-live.
  const progress =
    shell?.role === 'owner' && shell.tenant
      ? await loadSetupProgress({
          tenantId: shell.tenant.id,
          userId: shell.user.id,
          role: 'owner'
        })
      : null;
  const ctx = shell?.tenant
    ? { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role }
    : null;
  if (ctx) await requireModule(ctx, 'platform');
  const timeZone = ctx ? (await getBusinessSettings(ctx)).timezone : 'UTC';
  // Dashboard defaults are intentionally request-time values in this server component.
  // eslint-disable-next-line react/purity
  const now = new Date();
  const range = resolveDashboardRange(query, now, timeZone);
  const presets = {
    7: presetRange(7, now, timeZone),
    30: presetRange(30, now, timeZone),
    90: presetRange(90, now, timeZone)
  };
  const [metrics, guarantee] = ctx
    ? await Promise.all([getDashboardMetrics(ctx, range.from, range.to), getGuaranteeSettings(ctx)])
    : [null, null];
  const guaranteeCard = guarantee
    ? guaranteeProgress({
        baseline: guarantee.baselineOverride ?? guarantee.measuredBaseline,
        startDate: guarantee.startDate,
        booked: guarantee.bookedInWindow ?? 0,
        today: now
      })
    : null;
  const speed =
    metrics?.totals.speedToLeadMinutes == null
      ? 'No calls yet'
      : `${metrics.totals.speedToLeadMinutes} min`;
  const booking =
    metrics?.totals.bookingRate == null ? 'No leads yet' : `${metrics.totals.bookingRate}%`;

  return (
    <PageContainer
      pageTitle='Dashboard'
      pageDescription={`Results from ${shortDate(range.from)} to ${shortDate(range.to)}`}
    >
      {progress && <SetupProgressCard progress={progress} />}
      <form method='get' className='flex flex-wrap items-end gap-3' aria-label='Date range'>
        {(
          [
            ['7 days', presets[7]],
            ['30 days', presets[30]],
            ['90 days', presets[90]]
          ] as const
        ).map(([label, preset]) => (
          <a
            key={label}
            className='bg-card hover:bg-secondary inline-flex min-h-11 items-center rounded-[var(--radius-control)] border px-3 text-sm transition-colors'
            href={rangeHref(preset.from, preset.to)}
          >
            {label}
          </a>
        ))}
        <div className='grid gap-1'>
          <label htmlFor='dashboard-from' className='text-sm'>
            From
          </label>
          <Input id='dashboard-from' name='from' type='date' defaultValue={range.from} required />
        </div>
        <div className='grid gap-1'>
          <label htmlFor='dashboard-to' className='text-sm'>
            To
          </label>
          <Input id='dashboard-to' name='to' type='date' defaultValue={range.to} required />
        </div>
        <Button type='submit' variant='outline'>
          Apply
        </Button>
      </form>
      {range.notice ? (
        <p role='status' className='mt-3 rounded border p-3 text-sm'>
          {range.notice === DASHBOARD_RANGE_NOTICE ? range.notice : DASHBOARD_RANGE_NOTICE}
        </p>
      ) : null}
      {metrics && (
        <div className='mt-4 grid gap-4'>
          <StatTiles
            label='Dashboard in numbers'
            tiles={[
              { label: 'Leads', value: metrics.totals.leads, key: true },
              { label: 'Calls', value: metrics.totals.calls },
              { label: 'Reached', value: metrics.totals.contactsReached },
              { label: 'Booked', value: metrics.totals.estimatesBooked }
            ]}
          />
          <StatTiles
            label='Dashboard rates'
            tiles={[
              { label: 'Speed to lead', value: speed },
              { label: 'Booking rate', value: booking },
              {
                label: 'Revenue',
                value: `$${(metrics.totals.revenueCents / 100).toLocaleString('en-US')}`
              }
            ]}
          />
        </div>
      )}
      {metrics && (
        <div className='mt-4 grid min-w-0 gap-4 lg:grid-cols-3'>
          <div className='min-w-0 lg:col-span-2 [&>section]:h-full'>
            <DailyTrend days={metrics.days} />
          </div>
          <CountChart
            name='Conversion funnel'
            highlight='last'
            empty='No funnel activity in this range.'
            rows={[
              { label: 'Leads', value: metrics.totals.leads },
              { label: 'Reached', value: metrics.totals.contactsReached },
              { label: 'Booked', value: metrics.totals.estimatesBooked },
              { label: 'Won', value: metrics.totals.wonDeals }
            ]}
          />
          <CountChart
            name='Lead sources'
            ranked
            empty='No leads in this range.'
            rows={metrics.sources.map((source) => ({ label: source.source, value: source.leads }))}
          />
          <div className='bg-card rounded-[var(--radius-card)] border p-4 sm:p-5 lg:col-span-2'>
            <h2 className='text-base font-medium'>Recent activity</h2>
            <div className='mt-3 space-y-3'>
              {metrics.activity.length ? (
                metrics.activity.map((item) => (
                  <div key={item.id}>
                    <p className='text-sm'>{item.summary}</p>
                    <p className='text-muted-foreground text-xs'>
                      {item.type} ·{' '}
                      {new Date(item.occurredAt).toLocaleString('en-US', {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                        timeZone: 'UTC'
                      })}{' '}
                      UTC
                    </p>
                  </div>
                ))
              ) : (
                <p className='text-muted-foreground text-sm'>No recent activity.</p>
              )}
            </div>
          </div>
        </div>
      )}
      <div className='mt-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
        <p className='font-medium'>Booking guarantee</p>
        <p className='text-muted-foreground mt-1 text-sm'>
          20% more booked appointments than last month, measured over 30 days.
        </p>
        {guaranteeCard ? (
          <>
            <p className='mt-2 text-sm'>
              Last month: {guaranteeCard.baseline}. Target: {guaranteeCard.target}. Booked in this
              window: {guaranteeCard.booked}. {guaranteeCard.daysLeft} days left.
            </p>
            <div className='bg-muted mt-3 h-2 rounded'>
              <div
                className='bg-primary h-2 rounded'
                style={{ width: `${guaranteeCard.percent}%` }}
              />
            </div>
          </>
        ) : (
          <p className='text-muted-foreground mt-2 text-sm'>
            Not set yet. Kynetic enters last month&apos;s booked appointments before this starts.
          </p>
        )}
      </div>
    </PageContainer>
  );
}
