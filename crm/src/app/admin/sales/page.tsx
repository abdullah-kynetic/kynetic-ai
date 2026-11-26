import Link from 'next/link';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAgencyWorkspace } from '@/server/agency';
import { COLUMN_LABELS, PIPELINE_COLUMNS, loadSalesSide } from '@/server/agency/pipeline';
import { agencyCaller } from '../agency/caller';
import { loadClientRows } from '../clients/rows';
import { AGENCY_SYNTHETIC_SLUG } from '@/server/agency/constants';
import { setDealColumnAction } from './actions';

export const dynamic = 'force-dynamic';

const CLIENT_COLUMN: Record<string, 'building' | 'testing' | 'live'> = {
  building: 'building',
  testing: 'testing',
  live: 'live',
  at_risk: 'live'
};

/** Everyone in contact, on one board: Audit pending, Proposal, then the client stages. */
export default async function PipelinePage() {
  const caller = await agencyCaller();
  const workspace = await getAgencyWorkspace(caller);
  const [{ rows }, sales] = await Promise.all([
    loadClientRows(),
    workspace ? loadSalesSide(caller) : Promise.resolve({ deals: [], leadRows: [] })
  ]);
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
      <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-5'>
        {PIPELINE_COLUMNS.map((column) => {
          const deals = sales.deals.filter((d) => d.column === column);
          const here = clients.filter((c) => CLIENT_COLUMN[c.stage] === column);
          return (
            <section
              key={column}
              aria-label={`${COLUMN_LABELS[column]} stage`}
              className='bg-secondary/40 flex min-w-0 flex-col gap-2 rounded-xl border p-3'
            >
              <div className='flex items-center justify-between'>
                <h2 className='font-medium'>{COLUMN_LABELS[column]}</h2>
                <span className='ticket-meta'>{deals.length + here.length}</span>
              </div>
              {deals.map((d) => (
                <div key={d.dealId} className='bg-card grid gap-2 rounded-lg border p-3'>
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
                        Signed and paid: start building
                      </Link>
                      <form
                        action={setDealColumnAction.bind(null, d.dealId, 'declined')}
                        className='flex gap-2'
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
                </div>
              ))}
              {here.map((c) => (
                <Link
                  key={c.tenantId}
                  href={`/admin/clients/${c.tenantId}/build`}
                  className='bg-card hover:bg-secondary grid gap-1 rounded-lg border p-3'
                >
                  <span className='font-medium'>{c.name}</span>
                  <span className='text-muted-foreground text-xs'>
                    {c.stage === 'at_risk' ? 'At risk' : COLUMN_LABELS[column]} · client account
                  </span>
                </Link>
              ))}
              {deals.length + here.length === 0 && (
                <p className='text-muted-foreground text-xs'>Nobody here.</p>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
