import { getAgencyPipeline, getAgencyWorkspace, listAgencyLeads } from '@/server/agency';
import { agencyCaller } from '../../agency/caller';
import { SalesBoard } from '../board';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function SalesStagesPage() {
  const caller = await agencyCaller();
  const workspace = await getAgencyWorkspace(caller);
  if (!workspace)
    return (
      <section className='bg-card space-y-3 rounded-xl border p-6'>
        <h2 className='font-medium'>Start with a prospect</h2>
        <p className='text-muted-foreground text-sm'>
          Add a synthetic prospect in Prospecting to begin tracking a deal.
        </p>
        <Link className='text-primary underline' href='/admin/prospecting'>
          Open Prospecting
        </Link>
      </section>
    );
  const [{ stages }, { leads }] = await Promise.all([
    getAgencyPipeline(caller),
    listAgencyLeads(caller)
  ]);
  return (
    <SalesBoard
      stages={stages.map(({ id, name }) => ({ id, name }))}
      initialCards={leads
        .filter((lead) => lead.deal)
        .map((lead) => ({
          id: lead.deal!.dealId,
          name: lead.firstName,
          email: lead.email,
          stageId: lead.deal!.stageId
        }))}
    />
  );
}
