import Link from 'next/link';
import PageContainer, { AgencyEmptyState, AgencyStatus } from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getAgencyPipeline, getAgencyWorkspace, listAgencyLeads } from '@/server/agency';
import { listAgencyContracts } from '@/server/agency/contracts';
import { agencyCaller } from '../caller';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import {
  createContractAction,
  markContractSentAction,
  markContractSignedAction,
  voidContractAction
} from './actions';

export const dynamic = 'force-dynamic';

export default async function ContractsPage({
  searchParams
}: {
  searchParams: Promise<{ status?: string; stageId?: string; deal?: string; error?: string }>;
}) {
  const caller = await agencyCaller();
  if (!(await getAgencyWorkspace(caller))) return <AgencyWorkspaceMissing pageTitle='Contracts' />;
  const query = await searchParams;
  const [{ stages }, { leads }, contracts] = await Promise.all([
    getAgencyPipeline(caller),
    listAgencyLeads(caller),
    listAgencyContracts(caller, { status: query.status, stageId: query.stageId })
  ]);
  const deals = leads.flatMap((lead) =>
    lead.deal ? [{ id: lead.deal.dealId, name: lead.firstName }] : []
  );
  return (
    <PageContainer
      pageTitle='Contracts'
      pageDescription='Track draft, sent, signed and void agreements. Nothing is emailed or e-signed.'
    >
      <Link href='/admin/agency'>Agency dashboard</Link>
      {query.error && (
        <p role='alert'>That contract change could not be saved. Check the deal and the dates.</p>
      )}
      <form className='my-4 flex flex-wrap items-end gap-3'>
        <label>
          Status
          <select name='status' defaultValue={query.status ?? ''}>
            <option value=''>All</option>
            {['draft', 'sent', 'signed', 'void'].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          Stage
          <select name='stageId' defaultValue={query.stageId ?? ''}>
            <option value=''>All</option>
            {stages.map((stage) => (
              <option key={stage.id} value={stage.id}>
                {stage.name}
              </option>
            ))}
          </select>
        </label>
        <Button type='submit' variant='outline'>
          Filter
        </Button>
      </form>
      <form action={createContractAction} className='agency-form mb-8 max-w-xl'>
        <h2 className='font-semibold'>New contract</h2>
        <Label htmlFor='contract-deal'>Deal</Label>
        <select id='contract-deal' name='dealId' required defaultValue={query.deal ?? ''}>
          <option value=''>Choose a deal</option>
          {deals.map((deal) => (
            <option key={deal.id} value={deal.id}>
              {deal.name}
            </option>
          ))}
        </select>
        <Label htmlFor='contract-title'>Title</Label>
        <Input id='contract-title' name='title' required maxLength={200} />
        <Button type='submit' disabled={!deals.length}>
          Create contract
        </Button>
      </form>
      {!contracts.length && (
        <AgencyEmptyState
          title='No contracts yet'
          description='Create a draft for an agency deal. Mark it sent or signed when you do that yourself. No email is sent.'
        />
      )}
      <div className='space-y-4'>
        {contracts.map((contract) => (
          <article key={contract.id} className='rounded border p-4'>
            <h2 className='font-semibold'>{contract.title}</h2>
            <p>
              {contract.dealTitle} · {contract.stageName} · <AgencyStatus value={contract.status} />
            </p>
            <p className='text-sm'>
              <Link href={`/admin/agency/proposals?dealId=${contract.dealId}`}>Proposal draft</Link>
              {contract.signedFileKey ? (
                <>
                  {' '}
                  · <Link href={`/api/admin/agency/contracts/${contract.id}/file`}>Signed PDF</Link>
                </>
              ) : null}
            </p>
            {contract.status === 'draft' && (
              <form
                action={markContractSentAction.bind(null, contract.id)}
                className='mt-3 flex gap-2'
              >
                <Label htmlFor={`sent-${contract.id}`}>Sent on</Label>
                <Input id={`sent-${contract.id}`} name='sentOn' type='date' required />
                <Button type='submit' variant='outline'>
                  Mark sent
                </Button>
              </form>
            )}
            {(contract.status === 'draft' || contract.status === 'sent') && (
              <form
                action={markContractSignedAction.bind(null, contract.id)}
                className='mt-3 flex flex-wrap items-end gap-2'
              >
                <Label htmlFor={`signed-${contract.id}`}>Signed on</Label>
                <Input id={`signed-${contract.id}`} name='signedOn' type='date' required />
                <Label htmlFor={`notes-${contract.id}`}>Note</Label>
                <Input id={`notes-${contract.id}`} name='notes' maxLength={2000} />
                <label>
                  Signed PDF (optional)
                  <input name='file' type='file' accept='.pdf,application/pdf' />
                </label>
                <Button type='submit' variant='outline'>
                  Mark signed
                </Button>
              </form>
            )}
            {contract.status !== 'void' && (
              <form action={voidContractAction.bind(null, contract.id)} className='mt-3'>
                <Button type='submit' variant='outline'>
                  Void
                </Button>
              </form>
            )}
          </article>
        ))}
      </div>
    </PageContainer>
  );
}
