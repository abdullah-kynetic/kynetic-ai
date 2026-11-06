import { agencyChannel } from '@/components/agency/format';
import { getAgencyRates } from '@/server/agency/inbox';
import { percent } from '@/server/agency/rates';
import { US_STATE_CODES } from '@/server/agency/dialer-policy';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import PageContainer from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { decideAdminAccess } from '@/server/admin';
import {
  getAgencyWorkspace,
  getAgencyPipeline,
  listAgencyLeads,
  listAgencyAlerts
} from '@/server/agency';
import { isViewingAs } from '../view-as-guard';
import {
  createAgencyWorkspaceAction,
  createAgencyLeadAction,
  renameAgencyStageAction,
  moveAgencyDealAction
} from './actions';

export const dynamic = 'force-dynamic';
const channels = ['form', 'booking', 'referral', 'other', 'cold_call', 'sms', 'email', 'dm'];
const selectClass = 'border-input bg-background min-h-11 rounded-md border px-3';
export default async function AgencyPage({
  searchParams
}: {
  searchParams: Promise<{ direction?: string; channel?: string; error?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const caller = { id: access.user.id, kyneticRole: access.role };
  const workspace = await getAgencyWorkspace(caller);
  if (!workspace)
    return (
      <PageContainer
        pageTitle='Agency workspace'
        pageDescription='A separate synthetic workspace for Kynetic’s own sales.'
      >
        <p className='mb-4'>
          Create an empty workspace to try leads and sales stages. No calls, messages or invites are
          sent.
        </p>
        <form action={createAgencyWorkspaceAction}>
          <Button type='submit'>Create synthetic agency workspace</Button>
        </form>
      </PageContainer>
    );
  const query = await searchParams;
  const filter = {
    ...(['inbound', 'outbound'].includes(query.direction ?? '')
      ? { direction: query.direction }
      : {}),
    ...(channels.includes(query.channel ?? '') ? { channel: query.channel } : {})
  };
  const [{ stages }, data, alerts, rates] = await Promise.all([
    getAgencyPipeline(caller),
    listAgencyLeads(caller, filter),
    listAgencyAlerts(caller),
    getAgencyRates(caller)
  ]);
  return (
    <PageContainer
      pageTitle='Agency workspace'
      pageDescription='Synthetic leads and your sales pipeline. Outbound is disabled.'
    >
      {query.error && (
        <p role='alert' className='mb-4'>
          The change could not be saved. Check for a duplicate lead or stage name, use an
          @example.test email, and provide a reason when moving to Lost.
        </p>
      )}
      <section aria-label='Seven-day agency rates' className='agency-metrics'>
        <h2>Last seven days</h2>
        <dl>
          <div>
            <dt>Pick rate</dt>
            <dd>
              {percent(rates.pickRate)}
              <span>
                {rates.picked} answered / {rates.attempted} attempted calls
              </span>
            </dd>
          </div>
          <div>
            <dt>Reply rate</dt>
            <dd>
              {percent(rates.replyRate)}
              <span>
                {rates.replied} replies / {rates.contacted} messaged prospects
              </span>
            </dd>
          </div>
        </dl>
        <p>
          Replies count unique prospects after outreach in this window. Failed messages and
          simulated sends are excluded.
        </p>
      </section>

      <p className='agency-notice'>
        Synthetic workspace · Use fictional names and @example.test emails. No outreach starts from
        this page.
      </p>

      <section className='mb-8 space-y-4' aria-labelledby='agency-leads'>
        <h2 id='agency-leads' className='text-lg font-semibold'>
          Leads
        </h2>
        <dl className='agency-source-counts' aria-label='Lead source counts'>
          {data.counts.map((c) => (
            <div key={`${c.direction}-${c.channel}`}>
              <dt>
                {c.direction === 'inbound' ? 'Inbound' : 'Outbound'} · {agencyChannel(c.channel)}
              </dt>
              <dd>{c.count}</dd>
            </div>
          ))}
        </dl>
        <form className='flex flex-wrap items-end gap-3'>
          <div>
            <Label htmlFor='filterDirection'>Direction</Label>
            <select
              id='filterDirection'
              name='direction'
              defaultValue={query.direction ?? ''}
              className={`${selectClass} block`}
            >
              <option value=''>All</option>
              <option value='inbound'>Inbound</option>
              <option value='outbound'>Outbound</option>
            </select>
          </div>
          <div>
            <Label htmlFor='filterChannel'>Channel</Label>
            <select
              id='filterChannel'
              name='channel'
              defaultValue={query.channel ?? ''}
              className={`${selectClass} block`}
            >
              <option value=''>All</option>
              {channels.map((c) => (
                <option key={c} value={c}>
                  {c.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </div>
          <Button type='submit' variant='outline'>
            Filter
          </Button>
        </form>
        <p className='text-muted-foreground text-sm'>
          Latest 50 matching leads. Counts include all active agency prospects.
        </p>
        <ul className='space-y-3'>
          {data.leads.map((lead) => (
            <li
              key={lead.id}
              className='flex flex-wrap items-center justify-between gap-3 rounded border p-4'
            >
              <div>
                <p className='font-medium'>{lead.firstName}</p>
                <p className='text-muted-foreground text-sm'>
                  {lead.email} · {lead.source?.replace('agency_', '').replaceAll('_', ' ')}
                </p>
              </div>
              {lead.deal && (
                <form
                  action={moveAgencyDealAction.bind(null, lead.deal.dealId)}
                  className='flex flex-wrap items-end gap-2'
                >
                  <div>
                    <Label htmlFor={`stage-${lead.id}`}>Stage</Label>
                    <select
                      id={`stage-${lead.id}`}
                      name='stageId'
                      defaultValue={lead.deal.stageId}
                      className={`${selectClass} block`}
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label htmlFor={`lost-${lead.id}`}>Reason (if Lost)</Label>
                    <Input id={`lost-${lead.id}`} name='lostReason' maxLength={500} />
                  </div>
                  <Button type='submit' variant='outline'>
                    Move
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
        {data.leads.length === 0 && (
          <p className='text-muted-foreground'>No leads match these filters.</p>
        )}
      </section>
      <section aria-label='Agency alerts' className='agency-alerts'>
        <h2 className='font-semibold'>Agency alerts</h2>
        {alerts.length ? (
          alerts.map((a) => (
            <p key={a.id}>
              {a.title} · {a.body}
            </p>
          ))
        ) : (
          <p>No alerts yet.</p>
        )}
      </section>
      <section className='mb-8 space-y-4' aria-labelledby='agency-add-lead'>
        <h2 id='agency-add-lead' className='text-lg font-semibold'>
          Add a synthetic lead
        </h2>
        <form action={createAgencyLeadAction} className='agency-form grid gap-4 sm:grid-cols-2'>
          <div className='space-y-2'>
            <Label htmlFor='firstName'>Name</Label>
            <Input id='firstName' name='firstName' maxLength={200} required />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='email'>Synthetic email</Label>
            <Input
              id='email'
              name='email'
              type='email'
              placeholder='prospect@example.test'
              required
            />
          </div>
          <div className='space-y-2'>
            <Label htmlFor='phone'>Synthetic phone (optional)</Label>
            <Input id='phone' name='phone' type='tel' placeholder='+12025550123' />
            <p className='text-muted-foreground text-sm'>
              Use a reserved +1 area-code 555-01xx number.
            </p>
          </div>
          <div className='space-y-2'>
            <Label htmlFor='state'>State (required for dialer)</Label>
            <select id='state' name='state' className={`${selectClass} w-full`}>
              <option value=''>Unknown</option>
              {US_STATE_CODES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <p className='text-muted-foreground text-sm'>
              Florida and Oklahoma are excluded from the dialer.
            </p>
          </div>
          <div className='space-y-2 sm:col-span-2'>
            <Label htmlFor='source'>Lead source</Label>
            <select id='source' name='source' className={`${selectClass} w-full`}>
              <optgroup label='Inbound'>
                {['form', 'booking', 'referral', 'other'].map((c) => (
                  <option key={c} value={`inbound:${c}`}>
                    {c}
                  </option>
                ))}
              </optgroup>
              <optgroup label='Outbound'>
                {['cold_call', 'sms', 'email', 'dm'].map((c) => (
                  <option key={c} value={`outbound:${c}`}>
                    {c.replaceAll('_', ' ')}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
          <Button type='submit' className='sm:col-span-2'>
            Add lead
          </Button>
        </form>
      </section>
      <section className='space-y-3' aria-labelledby='agency-stages'>
        <h2 id='agency-stages' className='text-lg font-semibold'>
          Pipeline stages
        </h2>
        {stages.map((stage) => (
          <form
            key={stage.id}
            action={renameAgencyStageAction.bind(null, stage.id)}
            className='flex max-w-xl flex-wrap items-end gap-3'
          >
            <div className='flex-1'>
              <Label htmlFor={`name-${stage.id}`}>
                {stage.isWon
                  ? 'Won stage'
                  : stage.isLost
                    ? 'Lost stage'
                    : `Stage ${stage.position + 1}`}
              </Label>
              <Input id={`name-${stage.id}`} name='name' defaultValue={stage.name} required />
            </div>
            <Button type='submit' variant='outline'>
              Rename
            </Button>
          </form>
        ))}
      </section>
    </PageContainer>
  );
}
