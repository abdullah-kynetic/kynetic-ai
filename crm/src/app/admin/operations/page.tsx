/* oxlint-disable jsx-a11y/no-noninteractive-tabindex -- scrollable table regions must be keyboard focusable (WCAG 2.1.1) */
import Link from 'next/link';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import {
  decideAdminAccess,
  listAdminTenantOverview,
  listFailedWebhooks,
  listFlaggedCalls,
  listIntegrationHealth,
  listRecentJobs
} from '@/server/admin';
import {
  replayWebhookAction,
  reviewFlaggedCallAction,
  setTenantKillSwitchAction,
  suspendTenantAction
} from './actions';

export const dynamic = 'force-dynamic';

export default async function OperationsPage() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const platform = { userId: access.user.id, role: access.role };
  const [integrations, flagged, failedWebhooks, recentJobs, tenants] = await Promise.all([
    listIntegrationHealth(platform),
    listFlaggedCalls(platform),
    access.role === 'admin' ? listFailedWebhooks(platform) : Promise.resolve([]),
    access.role === 'admin'
      ? listRecentJobs({ userId: access.user.id, role: 'admin' })
      : Promise.resolve([]),
    access.role === 'admin' ? listAdminTenantOverview(platform) : Promise.resolve([])
  ]);
  return (
    <PageContainer
      pageTitle='Operations'
      pageDescription='Integration health and staff review controls.'
    >
      <section className='mb-8 space-y-3' aria-labelledby='integrations-heading'>
        <h2 id='integrations-heading' className='text-lg font-semibold'>
          Integration health
        </h2>
        {integrations.length ? (
          <div
            className='overflow-x-auto rounded-lg border'
            role='region'
            aria-label='Integration health table'
            tabIndex={0}
          >
            <table className='w-full text-sm'>
              <thead>
                <tr>
                  <th className='p-3 text-start'>Client</th>
                  <th className='p-3 text-start'>Integration</th>
                  <th className='p-3 text-start'>Status</th>
                  <th className='p-3 text-start'>A2P</th>
                  <th className='p-3 text-start'>Errors</th>
                  <th className='p-3 text-start'>Last error</th>
                </tr>
              </thead>
              <tbody>
                {integrations.map((row) => (
                  <tr key={`${row.tenantId}-${row.kind}`} className='border-t'>
                    <td className='p-3'>{row.tenantName}</td>
                    <td className='p-3'>{row.kind}</td>
                    <td className='p-3'>{row.status}</td>
                    <td className='p-3'>{row.a2pStatus}</td>
                    <td className='p-3'>{row.errorCount}</td>
                    <td className='p-3'>{row.lastError ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>No integration records.</p>
        )}
      </section>
      <section className='mb-8 space-y-3' aria-labelledby='flagged-heading'>
        <h2 id='flagged-heading' className='text-lg font-semibold'>
          Flagged calls for review
        </h2>
        {flagged.length ? (
          <ul className='divide-y rounded-lg border'>
            {flagged.map((row) => (
              <li key={row.callId} className='flex flex-wrap items-center gap-3 p-3'>
                <div className='min-w-0 flex-1'>
                  <p className='font-medium'>
                    {row.tenantName} · {row.flagNote ?? 'No reason provided'}
                  </p>
                  <p className='text-muted-foreground text-xs'>{row.startedAt}</p>
                </div>
                {access.role === 'admin' && (
                  <form action={reviewFlaggedCallAction}>
                    <input type='hidden' name='tenantId' value={row.tenantId} />
                    <input type='hidden' name='callId' value={row.callId} />
                    <button className='min-h-11 rounded-md border px-3 underline' type='submit'>
                      Mark reviewed
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p>No flagged calls waiting for review.</p>
        )}
      </section>
      {access.role === 'admin' && (
        <section className='space-y-3' aria-labelledby='controls-heading'>
          <h2 id='controls-heading' className='text-lg font-semibold'>
            Tenant controls
          </h2>
          <ul className='divide-y rounded-lg border'>
            {tenants.map((tenant) => (
              <li key={tenant.tenantId} className='flex flex-wrap items-center gap-3 p-3'>
                <Link
                  className='min-h-11 flex-1 underline'
                  href={`/admin/clients/${tenant.tenantId}/alex`}
                >
                  {tenant.name} · Alex configuration
                </Link>
                <form action={setTenantKillSwitchAction} className='flex items-center gap-2'>
                  <input type='hidden' name='tenantId' value={tenant.tenantId} />
                  <input type='hidden' name='enabled' value='true' />
                  <button className='min-h-11 rounded-md border px-3' type='submit'>
                    Stop outbound
                  </button>
                </form>
                <form action={setTenantKillSwitchAction}>
                  <input type='hidden' name='tenantId' value={tenant.tenantId} />
                  <input type='hidden' name='enabled' value='false' />
                  <button className='min-h-11 rounded-md border px-3' type='submit'>
                    Resume outbound
                  </button>
                </form>
                <form action={suspendTenantAction}>
                  <input type='hidden' name='tenantId' value={tenant.tenantId} />
                  <input
                    type='hidden'
                    name='suspended'
                    value={tenant.status === 'suspended' ? 'false' : 'true'}
                  />
                  <button className='min-h-11 rounded-md border px-3' type='submit'>
                    {tenant.status === 'suspended' ? 'Reactivate tenant' : 'Suspend tenant'}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
      {access.role === 'admin' && (
        <section className='mt-8 space-y-3' aria-labelledby='webhook-heading'>
          <h2 id='webhook-heading' className='text-lg font-semibold'>
            Failed webhooks
          </h2>
          {failedWebhooks.length ? (
            <ul className='divide-y rounded-lg border'>
              {failedWebhooks.map((event) => (
                <li key={event.eventId} className='flex flex-wrap items-center gap-3 p-3'>
                  <div className='min-w-0 flex-1'>
                    <p className='font-medium'>
                      {event.tenantName} · {event.source}
                    </p>
                    <p className='text-muted-foreground text-sm'>
                      {event.lastError} · {event.attempts} attempts
                    </p>
                  </div>
                  <form action={replayWebhookAction}>
                    <input type='hidden' name='webhookId' value={event.eventId} />
                    <button className='min-h-11 rounded-md border px-3 underline' type='submit'>
                      Replay failed event
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <p>No failed webhooks.</p>
          )}
        </section>
      )}
      {access.role === 'admin' && (
        <section className='mt-8 space-y-3' aria-labelledby='jobs-heading'>
          <h2 id='jobs-heading' className='text-lg font-semibold'>
            Recent jobs
          </h2>
          {recentJobs.length ? (
            <div
              className='overflow-x-auto rounded-lg border'
              role='region'
              aria-label='Recent jobs table'
              tabIndex={0}
            >
              <table className='w-full text-sm'>
                <thead>
                  <tr>
                    <th className='p-3 text-start'>Job</th>
                    <th className='p-3 text-start'>State</th>
                    <th className='p-3 text-start'>Created</th>
                    <th className='p-3 text-start'>Retries</th>
                  </tr>
                </thead>
                <tbody>
                  {recentJobs.map((job) => (
                    <tr key={job.id} className='border-t'>
                      <td className='p-3'>{job.name}</td>
                      <td className='p-3'>{job.state}</td>
                      <td className='p-3'>{job.createdAt}</td>
                      <td className='p-3'>{job.retryCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p>No recent jobs.</p>
          )}
        </section>
      )}
    </PageContainer>
  );
}
