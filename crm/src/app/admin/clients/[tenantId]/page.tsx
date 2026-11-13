import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess } from '@/server/admin';
import { loadClientOverview } from '@/server/admin/client-overview';
import { guaranteeProgress } from '@/server/metrics';
import { SYSTEM_CATALOG } from '@/server/modules/catalog';
import { AppError } from '@/server/errors';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { forbidden, notFound } from 'next/navigation';
import { GuaranteeForm } from './guarantee-form';
import { saveLlmCapAction, saveSpendCapAction } from './spend-cap-action';
import { PipelineFunnel } from './pipeline-funnel';

export const metadata: Metadata = { title: 'Client' };
export const dynamic = 'force-dynamic';

export default async function ClientOverviewPage({
  params
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = await params;
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  let overview: Awaited<ReturnType<typeof loadClientOverview>>;
  try {
    overview = await loadClientOverview({ id: access.user.id, kyneticRole: access.role }, tenantId);
  } catch (error) {
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  }
  const { tenant } = overview;
  const progress = guaranteeProgress({
    baseline: overview.guarantee.baselineOverride ?? overview.guarantee.measuredBaseline,
    startDate: overview.guarantee.startDate,
    booked: overview.guarantee.bookedInWindow ?? 0
  });
  const active = overview.modules.filter((module) => module.enabled);
  const links = [
    ['Systems', `/admin/clients/${tenant.id}/systems`],
    ['Reports', `/admin/clients/${tenant.id}/reports`],
    ['Service tokens', `/admin/clients/${tenant.id}/service-tokens`],
    ['Alex', `/admin/clients/${tenant.id}/alex`],
    ['Checklist', `/admin/clients/${tenant.id}/checklist`],
    ['Billing', `/admin/clients/${tenant.id}/billing`],
    ['Documents', `/admin/clients/${tenant.id}/documents`],
    ['Import', `/admin/clients/${tenant.id}/imports`],
    ['Webhooks', `/admin/clients/${tenant.id}/webhooks`],
    ['Online presence', `/admin/clients/${tenant.id}/presence`],
    ...(access.role === 'admin'
      ? ([['Offboard', `/admin/clients/${tenant.id}/offboard`]] as const)
      : [])
  ];

  return (
    <PageContainer
      pageTitle={tenant.name}
      pageDescription='Profile, systems, pipeline, and the booking guarantee for this client.'
    >
      <div className='grid gap-4 lg:grid-cols-2'>
        <section className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
          <h2 className='font-medium'>Profile</h2>
          <dl className='mt-3 space-y-2 text-sm'>
            <div>
              <dt className='text-muted-foreground'>Status</dt>
              <dd>
                {tenant.status} · {tenant.plan}
                {tenant.pricingTier ? ` · ${tenant.pricingTier}` : ''}
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Owner</dt>
              <dd>
                {overview.owners.length
                  ? overview.owners.map((owner) => owner.email).join(', ')
                  : overview.pendingOwnerEmail
                    ? `Invite pending for ${overview.pendingOwnerEmail}`
                    : 'No owner yet.'}
              </dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Phone</dt>
              <dd>{tenant.phone ?? 'No transfer number yet.'}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Time zone</dt>
              <dd>{tenant.timezone}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Hours</dt>
              <dd>{tenant.hours || 'No business hours yet.'}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Services</dt>
              <dd>{tenant.services.length ? tenant.services.join(', ') : 'No services yet.'}</dd>
            </div>
            <div>
              <dt className='text-muted-foreground'>Service area</dt>
              <dd>{tenant.zips.length ? tenant.zips.join(', ') : 'No zip codes yet.'}</dd>
            </div>
          </dl>
        </section>

        <section className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
          <h2 className='font-medium'>Booking guarantee</h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            20% more booked appointments than last month, measured over 30 days.
          </p>
          {progress ? (
            <div className='mt-3 text-sm'>
              <p>
                Baseline {progress.baseline}. Target {progress.target}. Booked in this window{' '}
                {progress.booked}. {progress.daysLeft} days left.
              </p>
              <progress
                className='mt-3 h-3 w-full accent-primary'
                max={Math.max(progress.target, 1)}
                value={Math.min(progress.booked, progress.target)}
                aria-label='Booking guarantee progress'
              />
              <p className='text-muted-foreground mt-1 text-xs'>
                {Math.min(100, Math.round((progress.booked / Math.max(progress.target, 1)) * 100))}%
                of target
              </p>
            </div>
          ) : (
            <p className='text-muted-foreground mt-3 text-sm'>
              Set a measurement start date. Leave the baseline blank to use last month&apos;s count.
            </p>
          )}
          {access.role === 'admin' && (
            <GuaranteeForm
              tenantId={tenant.id}
              baseline={overview.guarantee.baselineOverride}
              startDate={overview.guarantee.startDate}
              measured={overview.guarantee.measuredBaseline}
            />
          )}
        </section>

        <section className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
          <h2 className='font-medium'>Systems</h2>
          {active.length === 0 ? (
            <p className='text-muted-foreground mt-3 text-sm'>No systems are on yet.</p>
          ) : (
            <ul className='mt-3 space-y-2 text-sm'>
              {active.map((module) => (
                <li key={module.moduleKey}>
                  {SYSTEM_CATALOG[module.moduleKey].label}
                  {module.moduleKey === 'crm' && module.level
                    ? ` · ${module.level === 'full' ? 'Extended capabilities' : 'Core capabilities'}`
                    : ''}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
          <h2 className='font-medium'>Pipeline</h2>
          {overview.stages.length === 0 ? (
            <p className='text-muted-foreground mt-3 text-sm'>No pipeline yet.</p>
          ) : (
            <PipelineFunnel stages={overview.stages} />
          )}
        </section>

        {access.role === 'admin' && (
          <section className='rounded-xl bg-card p-4 ring-1 ring-foreground/10'>
            <h2 className='font-medium'>Spend cap</h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              Month-to-date provider cost. Blank means no cap. This does not change the monthly fee.
            </p>
            <form action={saveSpendCapAction} className='mt-3 flex flex-wrap items-end gap-2'>
              <input type='hidden' name='tenantId' value={tenant.id} />
              <label className='grid gap-1 text-sm'>
                Cap in cents
                <input
                  className='min-h-11 rounded border px-3'
                  name='cents'
                  inputMode='numeric'
                  defaultValue={tenant.monthlySpendCapCents ?? ''}
                  aria-label='Monthly spend cap in cents'
                />
              </label>
              <button className='min-h-11 rounded border px-3' type='submit'>
                Save cap
              </button>
            </form>
            <h2 className='mt-6 font-medium'>AI spend cap</h2>
            <p className='text-muted-foreground mt-1 text-sm'>
              Month-to-date model cost. Blank means the platform default applies. At the cap, no
              further model calls run for this client.
            </p>
            <form action={saveLlmCapAction} className='mt-3 flex flex-wrap items-end gap-2'>
              <input type='hidden' name='tenantId' value={tenant.id} />
              <label className='grid gap-1 text-sm'>
                AI cap in cents
                <input
                  className='min-h-11 rounded border px-3'
                  name='cents'
                  inputMode='numeric'
                  defaultValue={tenant.llmMonthlyCapCents ?? ''}
                  aria-label='Monthly AI spend cap in cents'
                />
              </label>
              <button className='min-h-11 rounded border px-3' type='submit'>
                Save AI cap
              </button>
            </form>
            {tenant.offboardedAt && (
              <p className='mt-3 text-sm'>
                Offboarded {tenant.offboardedAt}. Deletion due {tenant.deletionDueOn} is a date on
                the calendar only. Nothing is deleted automatically.
              </p>
            )}
          </section>
        )}

        <section className='rounded-xl bg-card p-4 ring-1 ring-foreground/10 lg:col-span-2'>
          <h2 className='font-medium'>Recent activity</h2>
          {overview.activity.length === 0 ? (
            <p className='text-muted-foreground mt-3 text-sm'>No activity yet.</p>
          ) : (
            <ul className='mt-3 space-y-3 text-sm'>
              {overview.activity.map((item) => (
                <li key={item.id}>
                  <p>{item.summary}</p>
                  <p className='text-muted-foreground text-xs'>
                    {item.type} · {item.occurredAt}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
      <nav aria-label='Client shortcuts' className='mt-4 flex flex-wrap gap-x-4 gap-y-1'>
        {links.map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className='text-primary-text inline-flex min-h-11 items-center underline'
          >
            {label}
          </Link>
        ))}
      </nav>
    </PageContainer>
  );
}
