import Link from 'next/link';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/layout/page-container';
import { decideAdminAccess, getTodayData } from '@/server/admin';
import { TodayBlock, NothingNeedsYou, TodayLink } from './today-block';

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const data = await getTodayData({ userId: access.user.id, role: access.role });
  return (
    <PageContainer
      pageTitle='Today'
      pageDescription='What needs attention across clients and operations today.'
    >
      {data.needsYouNow && (
        <TodayBlock title='Needs you now'>
          {data.needsYouNow.notices.length ||
          data.needsYouNow.agencyAlerts.length ||
          data.needsYouNow.failedJobs.length ? (
            <ul className='list-disc space-y-1 ps-5 text-sm'>
              {data.needsYouNow.notices.map((notice) => (
                <li key={notice.id}>{notice.title}</li>
              ))}
              {data.needsYouNow.agencyAlerts.map((alert) => (
                <li key={alert.id}>
                  {alert.title}: {alert.body}
                </li>
              ))}
              {data.needsYouNow.failedJobs.map((job) => (
                <li key={job.name}>
                  Failed jobs: {job.name} ({job.count})
                </li>
              ))}
            </ul>
          ) : (
            <NothingNeedsYou />
          )}
        </TodayBlock>
      )}
      {data.salesToday && (
        <TodayBlock title='Sales today'>
          {data.salesToday.dialer.next ||
          data.salesToday.dialer.callbacksDue.length ||
          data.salesToday.leads.length ||
          data.salesToday.flaggedCalls.length ? (
            <ul className='list-disc space-y-1 ps-5 text-sm'>
              {data.salesToday.dialer.next ? (
                <li>
                  <TodayLink href='/admin/agency/dialer'>
                    Next: {data.salesToday.dialer.next.name}
                    {data.salesToday.dialer.next.callbackDue ? ' (callback due)' : ''}
                  </TodayLink>
                </li>
              ) : null}
              {data.salesToday.dialer.callbacksDue.map((callback) => (
                <li key={callback.id}>
                  <TodayLink href='/admin/agency/dialer'>Callback due: {callback.name}</TodayLink>
                </li>
              ))}
              {data.salesToday.leads.map((lead) => (
                <li key={lead.name}>
                  New leads: {lead.name} ({lead.count})
                </li>
              ))}
              {data.salesToday.flaggedCalls.map((call) => (
                <li key={call.name}>
                  Flagged calls: {call.name} ({call.count})
                </li>
              ))}
            </ul>
          ) : (
            <NothingNeedsYou />
          )}
        </TodayBlock>
      )}
      <TodayBlock title='Clients needing attention'>
        {data.clientsNeedingAttention.length ? (
          <ul className='space-y-2 text-sm'>
            {data.clientsNeedingAttention.map((client) => (
              <li key={client.tenantId}>
                <TodayLink href={`/admin/clients/${client.tenantId}`}>
                  {client.name} · {client.healthScore} · {client.healthTone}
                </TodayLink>
              </li>
            ))}
          </ul>
        ) : (
          <NothingNeedsYou />
        )}
      </TodayBlock>
      <TodayBlock title='Support'>
        {data.support.open ? (
          <p className='text-sm'>
            <TodayLink href='/admin/support'>
              {data.support.open} open request{data.support.open === 1 ? '' : 's'}
            </TodayLink>
            {data.support.oldest ? ` · oldest: ${data.support.oldest.subject}` : ''}
          </p>
        ) : (
          <NothingNeedsYou />
        )}
      </TodayBlock>
      {data.dailySummary && (
        <TodayBlock title='Daily summary'>
          <p className='whitespace-pre-wrap text-sm'>{data.dailySummary.body}</p>
          <p className='mt-2 text-xs text-slate-500'>{data.dailySummary.note}</p>
        </TodayBlock>
      )}
      <Link href='/admin/clients' className='inline-flex min-h-11 items-center underline'>
        Open all clients
      </Link>
    </PageContainer>
  );
}
