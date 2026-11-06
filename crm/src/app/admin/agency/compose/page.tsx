import Link from 'next/link';
import PageContainer from '@/components/layout/page-container';
import { Button } from '@/components/ui/button';
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
  searchParams: Promise<{ contactId?: string; channel?: string; saved?: string }>;
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
      {q.saved && <p role='status'>Draft saved.</p>}
      <form action={saveMessageAction} className='my-6 max-w-xl space-y-4'>
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
        <Button disabled={!leads.length}>Save draft</Button>
      </form>
      <h2 className='font-semibold'>Recent drafts</h2>
      <div className='space-y-3'>
        {drafts.map((d) => (
          <article key={d.id} className='rounded border p-4'>
            <p>
              {d.channel} · {d.status}
              {d.block_reason ? ` · ${d.block_reason.replaceAll('_', ' ')}` : ''}
            </p>
            <p>{d.subject}</p>
            <p className='whitespace-pre-wrap'>{d.body}</p>
            <form action={previewMessageAction.bind(null, d.id)}>
              <Button variant='outline' disabled={d.status === 'simulated'}>
                Check gates / simulate
              </Button>
            </form>
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
