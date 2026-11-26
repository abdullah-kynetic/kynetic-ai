import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAgencyWorkspace } from '@/server/agency';
import { COLUMN_LABELS, PIPELINE_COLUMNS, loadSalesSide } from '@/server/agency/pipeline';
import { agencyCaller } from '../agency/caller';
import { loadClientRows } from '../clients/rows';
import { StartViewAsForm } from '../view-as/start-form';
import { AGENCY_SYNTHETIC_SLUG } from '@/server/agency/constants';
import { PipelineCard, PipelineColumn, PipelineDnd } from './pipeline-dnd';
import { sendInviteAction, setDealColumnAction, startBuildingAction } from './actions';

export const dynamic = 'force-dynamic';

const CLIENT_COLUMN: Record<string, 'proposal' | 'building' | 'testing' | 'live'> = {
  proposal: 'proposal',
  building: 'building',
  testing: 'testing',
  live: 'live',
  at_risk: 'live'
};

/** Everyone in contact, on one board: Audit pending, Proposal, then the client stages. */
const INVITE_NOTE: Record<string, string> = {
  sent: 'Invite sent. The link works once and expires in 7 days.',
  not_connected: 'Email delivery is not connected yet, so the invite was not sent.',
  failed: 'The invite could not be sent. Try again.'
};

export default async function PipelinePage({
  searchParams
}: {
  searchParams: Promise<{ invite?: string }>;
}) {
  const { invite } = await searchParams;
  const caller = await agencyCaller();
  const workspace = await getAgencyWorkspace(caller);
  const [{ rows, user }, sales] = await Promise.all([
    loadClientRows(),
    workspace ? loadSalesSide(caller) : Promise.resolve({ deals: [], leadRows: [] })
  ]);
  const canMove = user.kyneticRole === 'admin';
  const clients = rows.filter(
    (r) => r.slug !== AGENCY_SYNTHETIC_SLUG && !r.isDemo && r.stage in CLIENT_COLUMN
  );
  return (
    <div className='flex min-w-0 flex-col gap-4'>
      <p className='text-muted-foreground text-[15px]'>
        Everyone you are in contact with. People who have not answered, or said no, are on the{' '}
        <Link className='underline' href='/admin/sales/leads'>
          Leads tab
        </Link>
        .
      </p>
      {invite && INVITE_NOTE[invite] && (
        <p role='status' className='bg-secondary rounded-lg p-3 text-sm'>
          {INVITE_NOTE[invite]}
        </p>
      )}
      <PipelineDnd canMove={canMove}>
        <div className='-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-4 md:overflow-visible md:px-0 xl:grid-cols-5'>
          {PIPELINE_COLUMNS.map((column) => {
            const deals = sales.deals.filter((d) => d.column === column);
            const here = clients.filter((c) => CLIENT_COLUMN[c.stage] === column);
            return (
              <PipelineColumn
                key={column}
                column={column}
                label={COLUMN_LABELS[column]}
                count={deals.length + here.length}
              >
                {deals.map((d) => (
                  <PipelineCard
                    key={d.dealId}
                    name={d.name}
                    canMove={canMove}
                    data={{
                      kind: 'deal',
                      id: d.dealId,
                      column: d.column,
                      createHref: `/admin/clients/new?deal=${d.dealId}&name=${encodeURIComponent(d.name)}&email=${encodeURIComponent(d.email ?? '')}`
                    }}
                  >
                    <span className='font-medium'>{d.name}</span>
                    {d.email && <span className='text-muted-foreground text-xs'>{d.email}</span>}
                    {d.column === 'audit_pending' ? (
                      <form action={setDealColumnAction.bind(null, d.dealId, 'proposal')}>
                        <Button type='submit' variant='outline' size='sm'>
                          Audit done, start proposal
                        </Button>
                      </form>
                    ) : (
                      <>
                        <p className='text-muted-foreground text-xs'>
                          Scope of work, proposal, contract and demo.
                        </p>
                        <Link
                          className={buttonVariants({ variant: 'default', size: 'sm' })}
                          href={`/admin/clients/new?deal=${d.dealId}&name=${encodeURIComponent(d.name)}&email=${encodeURIComponent(d.email ?? '')}`}
                        >
                          Create the client account
                        </Link>
                        <form
                          action={setDealColumnAction.bind(null, d.dealId, 'declined')}
                          className='grid gap-2'
                        >
                          <Input
                            name='reason'
                            aria-label={`Why ${d.name} declined`}
                            placeholder='Why they declined'
                            required
                          />
                          <Button type='submit' variant='outline' size='sm'>
                            Declined
                          </Button>
                        </form>
                      </>
                    )}
                  </PipelineCard>
                ))}
                {here.map((c) => (
                  <PipelineCard
                    key={c.tenantId}
                    name={c.name}
                    canMove={canMove}
                    data={{ kind: 'client', id: c.tenantId, column }}
                  >
                    <Link
                      href={`/admin/clients/${c.tenantId}/build`}
                      className='grid gap-1 hover:underline'
                    >
                      <span className='font-medium'>{c.name}</span>
                      <span className='text-muted-foreground text-xs'>
                        {c.stage === 'at_risk' ? 'At risk' : COLUMN_LABELS[column]} · client account
                      </span>
                    </Link>
                    <StartViewAsForm
                      tenantId={c.tenantId}
                      tenantName={c.name}
                      reasonRequired={user.kyneticRole !== 'admin'}
                    />
                    {c.stage === 'proposal' && (
                      <>
                        <p className='text-muted-foreground text-xs'>
                          Account is ready. Nothing has been sent to the owner.
                        </p>
                        <form action={startBuildingAction.bind(null, c.tenantId)}>
                          <Button type='submit' size='sm'>
                            Signed and paid: start building
                          </Button>
                        </form>
                      </>
                    )}
                    {c.stage === 'building' && (
                      <form action={sendInviteAction.bind(null, c.tenantId)}>
                        <Button type='submit' variant='outline' size='sm'>
                          Send the owner invite
                        </Button>
                      </form>
                    )}
                  </PipelineCard>
                ))}
                {deals.length + here.length === 0 && (
                  <p className='text-muted-foreground text-xs'>Nobody here.</p>
                )}
              </PipelineColumn>
            );
          })}
        </div>
      </PipelineDnd>
    </div>
  );
}
