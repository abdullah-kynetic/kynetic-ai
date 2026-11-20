import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { decideAdminAccess, getTodayData } from '@/server/admin';
import { TodayBlock, NothingNeedsYou, TodayLink, StatusPill } from './today-block';
import { TodayKpis, type Kpi } from './today-kpis';
import { AreaLayout } from '@/components/layout/area-layout';
import { adminAreas } from '@/config/area-nav';

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const dynamic = 'force-dynamic';

export default async function AdminHomePage() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok') forbidden();
  const data = await getTodayData({
    userId: access.user.id,
    role: access.role
  });
  const needs = data.needsYouNow
    ? data.needsYouNow.notices.length +
      data.needsYouNow.agencyAlerts.length +
      data.needsYouNow.failedJobs.length
    : 0;
  const callbacks = data.salesToday?.dialer.callbacksDue.length ?? 0;
  const clients = data.clientsNeedingAttention.length;
  const support = data.support.open;
  const headline = needs
    ? `${needs} ${plural(needs, 'thing needs', 'things need')} you today`
    : clients
      ? `${clients} ${plural(clients, 'client needs', 'clients need')} a look today`
      : support
        ? `${support} support ${plural(support, 'request is', 'requests are')} waiting`
        : 'Everything is on track today';
  const kpis: Kpi[] = [
    ...(data.needsYouNow
      ? [
          {
            label: 'Needs you now',
            value: needs,
            unit: plural(needs, 'item', 'items'),
            tone: needs ? 'alert' : 'gain',
            word: needs ? 'Act today' : 'Clear'
          } satisfies Kpi,
          {
            label: 'Callbacks due',
            value: callbacks,
            unit: plural(callbacks, 'call', 'calls'),
            tone: callbacks ? 'attention' : 'gain',
            word: callbacks ? 'Due' : 'None due'
          } satisfies Kpi
        ]
      : []),
    {
      label: 'Clients needing attention',
      value: clients,
      unit: `of ${data.totalClients} ${plural(data.totalClients, 'client', 'clients')}`,
      tone: clients ? 'attention' : 'gain',
      word: clients ? 'Needs a look' : 'On track'
    },
    {
      label: 'Open support requests',
      value: support,
      unit: plural(support, 'request', 'requests'),
      tone: support ? 'attention' : 'gain',
      word: support ? 'Open' : 'Clear'
    }
  ];
  return (
    <AreaLayout area={adminAreas[0]!}>
      <div className='space-y-6'>
        <header>
          <h2 className='text-[28px]/[1.15] font-medium tracking-[-0.01em] md:text-[40px]/[1.1] md:tracking-[-0.02em]'>
            {headline}
          </h2>
          <p className='text-muted-foreground mt-1 text-[15px]'>
            Across clients and operations, as of now.
          </p>
        </header>
        <TodayKpis items={kpis} />
        <div className='grid grid-cols-1 gap-4 lg:grid-cols-2 [&>section]:min-w-0'>
          {data.needsYouNow && (
            <TodayBlock
              title='Needs you now'
              action={{ href: '/admin/operations', label: 'Open operations' }}
            >
              {data.needsYouNow.notices.length ||
              data.needsYouNow.agencyAlerts.length ||
              data.needsYouNow.failedJobs.length ? (
                <ul className='list-disc space-y-1.5 ps-5 text-sm'>
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
            <TodayBlock
              title='Sales today'
              action={{
                href: '/admin/prospecting/dialer',
                label: 'Open dialer'
              }}
            >
              {data.salesToday.dialer.next ||
              data.salesToday.dialer.callbacksDue.length ||
              data.salesToday.leads.length ||
              data.salesToday.flaggedCalls.length ? (
                <ul className='list-disc space-y-1.5 ps-5 text-sm'>
                  {data.salesToday.dialer.next ? (
                    <li>
                      <TodayLink href='/admin/prospecting/dialer'>
                        Next: {data.salesToday.dialer.next.name}
                        {data.salesToday.dialer.next.callbackDue ? ' (callback due)' : ''}
                      </TodayLink>
                    </li>
                  ) : null}
                  {data.salesToday.dialer.callbacksDue.map((callback) => (
                    <li key={callback.id}>
                      <TodayLink href='/admin/prospecting/dialer'>
                        Callback due: {callback.name}
                      </TodayLink>
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
          <TodayBlock
            title='Clients needing attention'
            action={{ href: '/admin/clients', label: 'Open all clients' }}
          >
            {data.clientsNeedingAttention.length ? (
              <ul className='space-y-2 text-sm'>
                {data.clientsNeedingAttention.map((client) => (
                  <li key={client.tenantId}>
                    <TodayLink href={`/admin/clients/${client.tenantId}`}>{client.name}</TodayLink>{' '}
                    <StatusPill tone={client.healthTone === 'red' ? 'alert' : 'attention'}>
                      {client.healthTone === 'red' ? 'At risk' : 'Watch'} · health{' '}
                      {client.healthScore}
                    </StatusPill>
                  </li>
                ))}
              </ul>
            ) : (
              <NothingNeedsYou />
            )}
          </TodayBlock>
          <TodayBlock title='Support' action={{ href: '/admin/support', label: 'Open support' }}>
            {data.support.open ? (
              <p className='text-sm'>
                <TodayLink href='/admin/support'>
                  {data.support.open} open request
                  {data.support.open === 1 ? '' : 's'}
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
              <p className='mt-2 text-muted-foreground text-xs'>{data.dailySummary.note}</p>
            </TodayBlock>
          )}
        </div>
      </div>
    </AreaLayout>
  );
}
