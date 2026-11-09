import Link from 'next/link';
import { CampaignSequence } from './sequence';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { decideAdminAccess } from '@/server/admin';
import { getAgencyWorkspace, listAgencyLeads } from '@/server/agency';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import { listAgencyCampaigns } from '@/server/agency/campaigns';
import { DEFAULT_DIALER_SCRIPT } from '@/server/agency/dialer-policy';
import { isViewingAs } from '../../view-as-guard';
import { assignCampaignAction, createCampaignAction } from './actions';
export const dynamic = 'force-dynamic';
export default async function CampaignsPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const caller = { id: access.user.id, kyneticRole: access.role };
  if (!(await getAgencyWorkspace(caller)))
    return <AgencyWorkspaceMissing pageTitle='Agency campaigns' />;
  const [campaigns, data, query] = await Promise.all([
    listAgencyCampaigns(caller),
    listAgencyLeads(caller),
    searchParams
  ]);
  return (
    <PageContainer
      pageTitle='Agency campaigns'
      pageDescription='Organize leads and review their recorded manual outcomes.'
    >
      <Link href='/admin/agency' className='mb-4 inline-flex min-h-11 items-center underline'>
        Back to agency workspace
      </Link>
      {query.error && (
        <p role='alert'>Use a unique campaign name and a script between 1 and 5,000 characters.</p>
      )}
      <form action={createCampaignAction} className='agency-form mb-8 max-w-2xl'>
        <div>
          <Label htmlFor='name'>Campaign name</Label>
          <Input id='name' name='name' maxLength={120} required />
        </div>
        <div>
          <Label htmlFor='script'>Draft call script</Label>
          <textarea
            id='script'
            name='script'
            defaultValue={DEFAULT_DIALER_SCRIPT}
            maxLength={5000}
            required
            className='border-input bg-background mt-2 min-h-32 w-full rounded border p-3'
          />
        </div>
        <Button type='submit'>Create campaign</Button>
      </form>
      <p className='text-muted-foreground mb-4 text-sm'>
        Results summarize manual outcomes for assigned leads, including outcomes recorded before
        assignment. They do not measure attribution or send messages. Assignment choices show the
        latest 50 agency leads.
      </p>
      <div className='space-y-5'>
        {campaigns.map((c) => (
          <section
            key={c.id}
            className='agency-panel space-y-4'
            aria-labelledby={`campaign-${c.id}`}
          >
            <h2 id={`campaign-${c.id}`} className='text-lg font-semibold'>
              {c.name}
            </h2>
            <p>
              {c.assigned} assigned · {c.logged} manual outcomes
            </p>
            <p>
              {Object.entries(c.outcomes)
                .map(([outcome, n]) => `${outcome.replaceAll('_', ' ')}: ${n}`)
                .join(' · ') || 'No outcomes yet.'}
            </p>
            <form
              action={assignCampaignAction.bind(null, c.id)}
              className='flex flex-wrap items-end gap-3'
            >
              <div>
                <Label htmlFor={`contact-${c.id}`}>Assign lead</Label>
                <select
                  id={`contact-${c.id}`}
                  name='contactId'
                  required
                  className='border-input bg-background block min-h-11 rounded border px-3'
                >
                  {data.leads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.firstName}
                    </option>
                  ))}
                </select>
              </div>
              <Button type='submit' variant='outline' disabled={data.leads.length === 0}>
                Assign
              </Button>
            </form>
            <CampaignSequence caller={caller} id={c.id} steps={c.steps} />
            <Link
              href={`/admin/agency/dialer?campaignId=${c.id}`}
              className='inline-flex min-h-11 items-center underline'
            >
              Open campaign queue
            </Link>
          </section>
        ))}
      </div>
    </PageContainer>
  );
}
