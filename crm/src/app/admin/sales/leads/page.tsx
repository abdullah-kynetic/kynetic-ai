import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getAgencyWorkspace } from '@/server/agency';
import { loadSalesSide } from '@/server/agency/pipeline';
import { agencyCaller } from '../../agency/caller';
import { setDealColumnAction } from '../actions';

export const dynamic = 'force-dynamic';

/** People who have not answered yet, and people who said no (with the reason). */
export default async function LeadsPage() {
  const caller = await agencyCaller();
  const workspace = await getAgencyWorkspace(caller);
  const { leadRows } = workspace ? await loadSalesSide(caller) : { leadRows: [] };
  const declined = leadRows.filter((l) => l.state === 'declined');
  const fresh = leadRows.filter((l) => l.state === 'new');
  return (
    <div className='grid gap-6'>
      <section className='bg-card grid gap-2 rounded-xl border p-4' aria-label='Not in contact yet'>
        <h2 className='font-medium'>Not in contact yet ({fresh.length})</h2>
        <p className='text-muted-foreground text-sm'>
          Prospects are found and enriched in{' '}
          <Link className='underline' href='/admin/prospecting'>
            Prospecting
          </Link>
          . When you book an audit, they move to Audit pending on the pipeline.
        </p>
        <ul className='grid gap-2'>
          {fresh.map((l) => (
            <li key={`${l.name}-${l.email}`} className='flex flex-wrap items-center gap-3'>
              <span className='font-medium'>{l.name}</span>
              {l.email && <span className='text-muted-foreground text-xs'>{l.email}</span>}
              {l.dealId && (
                <form action={setDealColumnAction.bind(null, l.dealId, 'audit_pending')}>
                  <Button type='submit' variant='outline' size='sm'>
                    Audit booked
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>
      <section className='bg-card grid gap-2 rounded-xl border p-4' aria-label='Declined'>
        <h2 className='font-medium'>Said no ({declined.length})</h2>
        <ul className='grid gap-2'>
          {declined.map((l) => (
            <li key={l.dealId ?? l.name} className='grid gap-1 text-sm'>
              <span className='font-medium'>{l.name}</span>
              <span className='text-muted-foreground'>{l.reason ?? 'No reason recorded'}</span>
              {l.dealId && (
                <form
                  action={setDealColumnAction.bind(null, l.dealId, 'audit_pending')}
                  className='flex gap-2'
                >
                  <Input type='hidden' name='reason' value='' />
                  <Button type='submit' variant='outline' size='sm'>
                    Back to Audit pending
                  </Button>
                </form>
              )}
            </li>
          ))}
          {declined.length === 0 && <li className='text-muted-foreground text-sm'>Nobody yet.</li>}
        </ul>
      </section>
    </div>
  );
}
