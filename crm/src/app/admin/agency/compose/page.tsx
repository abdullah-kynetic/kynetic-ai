import Link from 'next/link';
import PageContainer, { AgencyEmptyState, AgencyStatus } from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { agencyCaller } from '../caller';
import { getAgencyWorkspace, listAgencyLeads } from '@/server/agency';
import { listAgencyDrafts } from '@/server/agency/messaging';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import { saveMessageAction, previewMessageAction } from './actions';
export const dynamic = 'force-dynamic';
export default async function Compose({
  searchParams
}: {
  searchParams: Promise<{ contactId?: string; channel?: string; saved?: string; error?: string }>;
}) {
  const caller = await agencyCaller();
  if (!(await getAgencyWorkspace(caller)))
    return <AgencyWorkspaceMissing pageTitle='Compose agency message' />;
  const [q, { leads }, drafts] = await Promise.all([
    searchParams,
    listAgencyLeads(caller),
    listAgencyDrafts(caller)
  ]);
  return (
    <PageContainer
      pageTitle='Compose agency message'
      pageDescription='Save SMS/email drafts and check delivery gates. Real delivery is disabled.'
    >
      <Link href='/admin/agency/inbox'>Agency inbox</Link>
      <p>
        Check gates records a local result. It does not text or email anyone, in stub mode or live
        mode. Real delivery stays off.
      </p>
      {q.saved && <p role='status'>Draft saved.</p>}
      {q.error === 'blocked' && (
        <p role='alert'>Real delivery is blocked. The draft was kept and nothing was sent.</p>
      )}
      {q.error === 'check' && (
        <p role='alert'>The gate check could not be saved. Nothing was sent.</p>
      )}
      <div className='agency-columns'>
        <form action={saveMessageAction} className='agency-form'>
          <h2>New draft</h2>
          <label>
            Prospect
            <select name='contactId' required defaultValue={q.contactId}>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.firstName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Channel
            <select name='channel' defaultValue={q.channel === 'email' ? 'email' : 'sms'}>
              <option>sms</option>
              <option>email</option>
            </select>
          </label>
          <label htmlFor='compose-subject'>
            Subject (email)
            <Input id='compose-subject' name='subject' maxLength={200} />
          </label>
          <label>
            Message
            <textarea
              name='body'
              required
              maxLength={5000}
              className='block min-h-32 w-full border p-3'
            />
          </label>
          <Button type='submit' disabled={!leads.length}>
            Save draft
          </Button>
        </form>
        <section>
          <h2>Recent drafts</h2>
          {!drafts.length && (
            <AgencyEmptyState
              title='Your drafts will appear here'
              description='Save a message on the left, then check its delivery gates. Nothing is sent.'
            />
          )}
          <div className='agency-list'>
            {drafts.map((d) => (
              <article key={d.id}>
                <div className='agency-message-heading'>
                  <span className='text-sm font-medium'>{d.channel.toUpperCase()}</span>
                  <AgencyStatus value={d.status} />
                </div>
                {d.block_reason && (
                  <p className='text-sm text-muted-foreground'>
                    {d.block_reason.replaceAll('_', ' ')}
                  </p>
                )}
                <p>{d.subject}</p>
                <p className='agency-message-body'>{d.body}</p>
                <form action={previewMessageAction.bind(null, d.id)}>
                  <Button type='submit' variant='outline' disabled={d.status === 'simulated'}>
                    Check gates / simulate
                  </Button>
                </form>
              </article>
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
