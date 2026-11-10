import PageContainer from '@/components/layout/page-container';
import { SetupProgressCard } from '@/components/onboarding/setup-progress-card';
import { loadSetupProgress } from '@/server/admin';
import { loadShellContext } from '@/server/shell';
import { cookies, headers } from 'next/headers';
import { getDashboardMetrics, getGuaranteeSettings, guaranteeProgress } from '@/server/metrics';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
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
  // Dashboard defaults are intentionally request-time values in this server component.
  // eslint-disable-next-line react/purity
  const today = new Date();
  // eslint-disable-next-line react/purity
  const from = new Date(today);
  from.setUTCDate(from.getUTCDate() - 29);
  const [metrics, guarantee] = ctx
    ? await Promise.all([
        getDashboardMetrics(ctx, from.toISOString().slice(0, 10), today.toISOString().slice(0, 10)),
        getGuaranteeSettings(ctx)
      ])
    : [null, null];
  const guaranteeCard = guarantee
    ? guaranteeProgress({
        baseline: guarantee.baselineOverride ?? guarantee.measuredBaseline,
        startDate: guarantee.startDate,
        booked: guarantee.bookedInWindow ?? 0,
        today
      })
    : null;

  return (
    <PageContainer pageTitle='Dashboard' pageDescription='Your last 30 days at a glance.'>
      {progress && <SetupProgressCard progress={progress} />}
      {metrics && (
        <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-5'>
          {[
            ['Leads', metrics.totals.leads],
            ['Calls', metrics.totals.calls],
            ['Reached', metrics.totals.contactsReached],
            ['Booked', metrics.totals.estimatesBooked],
            ['Revenue', `$${(metrics.totals.revenueCents / 100).toLocaleString()}`]
          ].map(([label, value]) => (
            <div key={String(label)} className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
              <p className='text-muted-foreground text-sm'>{label}</p>
              <p className='mt-2 text-2xl font-semibold'>{value}</p>
            </div>
          ))}
        </div>
      )}
      {metrics && (
        <div className='mt-4 rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
          <p className='font-medium'>Lead sources</p>
          <div className='mt-3 space-y-2'>
            {metrics.sources.map((source) => (
              <div key={source.source} className='flex items-center gap-3 text-sm'>
                <span className='w-32 truncate'>{source.source}</span>
                <div className='bg-muted h-2 flex-1 rounded'>
                  <div
                    className='bg-primary h-2 rounded'
                    style={{ width: `${Math.min(100, source.leads * 20)}%` }}
                  />
                </div>
                <span>{source.leads}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {metrics && (
        <div className='mt-4 grid gap-4 lg:grid-cols-2'>
          <div className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
            <p className='font-medium'>Daily activity</p>
            <div className='mt-4 flex h-32 items-end gap-1'>
              {metrics.days.map((day) => (
                <div
                  key={day.day}
                  className='bg-primary/70 min-w-1 flex-1 rounded-t'
                  title={`${day.day}: ${day.leads} leads`}
                  style={{
                    height: `${Math.max(4, Math.min(100, day.leads * 20 + day.estimatesBooked * 30))}%`
                  }}
                />
              ))}
            </div>
          </div>
          <div className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
            <p className='font-medium'>Recent activity</p>
            <div className='mt-3 space-y-3'>
              {metrics.activity.length ? (
                metrics.activity.map((item) => (
                  <div key={item.id}>
                    <p className='text-sm'>{item.summary}</p>
                    <p className='text-muted-foreground text-xs'>
                      {item.type} · {item.occurredAt}
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
