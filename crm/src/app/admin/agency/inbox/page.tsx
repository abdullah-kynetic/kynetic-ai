import { agencyDateTime } from '@/components/agency/format';
import Link from 'next/link';
import PageContainer, { AgencyEmptyState, AgencyStatus } from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { agencyCaller } from '../caller';
import { listAgencyInbox, inboxFilter } from '@/server/agency/inbox';
import { listAgencyLeads, getAgencyWorkspace } from '@/server/agency';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import { logDmAction } from './actions';
export const dynamic = 'force-dynamic';
export default async function Inbox({
  searchParams
}: {
  searchParams: Promise<{ channel?: string; status?: string; contactId?: string }>;
}) {
  const caller = await agencyCaller();
  if (!(await getAgencyWorkspace(caller)))
    return <AgencyWorkspaceMissing pageTitle='Agency inbox' />;
  const q = await searchParams,
    parsed = inboxFilter.safeParse(Object.fromEntries(Object.entries(q).filter(([, v]) => v)));
  const [rows, { leads }] = await Promise.all([
    listAgencyInbox(caller, parsed.success ? parsed.data : {}),
    listAgencyLeads(caller)
  ]);
  return (
    <PageContainer
      pageTitle='Agency inbox'
      pageDescription='SMS, email, and manually recorded DMs. No DM account is connected.'
    >
      <Link href='/admin/agency'>Agency dashboard</Link>
      <div className='agency-inbox-grid'>
        <div>
          <form className='agency-filter'>
            <label>
              Channel{' '}
              <select name='channel' defaultValue={q.channel ?? ''}>
                <option value=''>All</option>
                {['sms', 'email', 'dm'].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <label>
              Status{' '}
              <select name='status' defaultValue={q.status ?? ''}>
                <option value=''>All</option>
                {[
                  'received',
                  'sent',
                  'delivered',
                  'failed',
                  'queued',
                  'bounced',
                  'complained',
                  'logged'
                ].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
            <Button type='submit'>Filter</Button>
          </form>
          <section className='agency-list' aria-label='Conversations'>
            {rows.length ? (
              rows.map((m) => (
                <article key={m.id}>
                  <div className='agency-message-heading'>
                    <h2>{m.name}</h2>
                    <AgencyStatus value={m.status} />
                  </div>
                  <div className='agency-message-meta'>
                    <span>
                      {m.channel.toUpperCase()} · {m.direction}
                    </span>
                    <time dateTime={m.at}>{agencyDateTime(m.at)}</time>
                  </div>
                  {m.subject && <p>{m.subject}</p>}
                  <p className='agency-message-body'>{m.body}</p>
                  {m.channel !== 'dm' && (
                    <Link
                      href={`/admin/agency/compose?contactId=${m.contact_id}&channel=${m.channel === 'dm' ? 'sms' : m.channel}`}
                    >
                      Compose reply
                    </Link>
                  )}
                </article>
              ))
            ) : (
              <AgencyEmptyState
                title='No matching messages.'
                description='Try another filter, or record a synthetic DM below to start the conversation history.'
              />
            )}
          </section>
        </div>
        <aside aria-label='Record a DM'>
          <form action={logDmAction} className='agency-form' id='log-dm'>
            <h2 className='font-semibold'>Log a DM manually</h2>
            <label>
              Prospect{' '}
              <select name='contactId' required>
                {leads.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.firstName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Direction{' '}
              <select name='direction'>
                <option>inbound</option>
                <option>outbound</option>
              </select>
            </label>
            <label htmlFor='inbox-platform'>
              Platform
              <Input id='inbox-platform' name='platform' required maxLength={80} />
            </label>
            <label>
              Message
              <textarea name='body' required maxLength={5000} className='block w-full border p-2' />
            </label>
            <Button type='submit' disabled={!leads.length}>
              Save log
            </Button>
          </form>
        </aside>
      </div>
    </PageContainer>
  );
}
