import Link from 'next/link';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/agency/page';
import { AgencySubmitButton as Button } from '@/components/agency/motion';
import { Label } from '@/components/ui/label';
import { AppError } from '@/server/errors';
import { ModuleDisabledError } from '@/server/modules';
import { decideAdminAccess } from '@/server/admin';
import { getAgencyWorkspace } from '@/server/agency';
import { listAgencyProposals, listProposalDeals } from '@/server/proposals';
import { AgencyWorkspaceMissing } from '../workspace-missing';
import { isViewingAs } from '../../view-as-guard';
import { openProposalAction } from './actions';
export const dynamic = 'force-dynamic';
export default async function ProposalsPage({
  searchParams
}: {
  searchParams: Promise<{ dealId?: string; error?: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const caller = { id: access.user.id, kyneticRole: access.role };
  if (!(await getAgencyWorkspace(caller)))
    return <AgencyWorkspaceMissing pageTitle='Proposal drafts' />;
  const [drafts, deals, query] = await Promise.all([
    listAgencyProposals(caller),
    listProposalDeals(caller),
    searchParams
  ]).catch((error: unknown) => {
    if (error instanceof ModuleDisabledError) forbidden();
    if (error instanceof AppError && error.code === 'NOT_FOUND') notFound();
    throw error;
  });
  return (
    <PageContainer
      pageTitle='Proposal drafts'
      pageDescription='Internal proposal drafts linked to agency deals.'
    >
      <Link href='/admin/agency' className='mb-4 inline-flex min-h-11 items-center underline'>
        Back to agency workspace
      </Link>
      <p className='mb-6 rounded border p-3'>
        Drafts stay internal. Saving a draft does not send it or move the deal to Proposal Sent.
      </p>
      {query.error && (
        <p role='alert' className='mb-4'>
          That deal is unavailable. Choose a current agency deal.
        </p>
      )}
      {deals.length ? (
        <form action={openProposalAction} className='mb-8 flex flex-wrap items-end gap-3'>
          <div>
            <Label htmlFor='dealId'>Agency deal</Label>
            <select
              id='dealId'
              name='dealId'
              defaultValue={deals.some((d) => d.id === query.dealId) ? query.dealId : deals[0]!.id}
              className='border-input bg-background block min-h-11 max-w-full rounded border px-3'
            >
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>
          <Button type='submit'>Open or create draft</Button>
        </form>
      ) : (
        <p className='mb-8'>Add an agency lead to create its deal first.</p>
      )}
      <h2 className='mb-3 text-lg font-semibold'>Recent drafts</h2>
      <p className='text-muted-foreground mb-3 text-sm'>Latest 50 drafts for live agency deals.</p>
      <ul className='space-y-3'>
        {drafts.map((d) => (
          <li
            key={d.id}
            className='flex flex-wrap items-center justify-between gap-3 rounded border p-4'
          >
            <div>
              <Link
                href={`/admin/agency/proposals/${d.id}`}
                className='inline-flex min-h-11 items-center font-medium underline'
              >
                {d.title}
              </Link>
              <p className='text-muted-foreground text-sm'>{d.dealTitle} · Draft</p>
            </div>
            <Link
              href={`/admin/agency/proposals/${d.id}/preview`}
              className='inline-flex min-h-11 items-center underline'
            >
              Preview draft
            </Link>
          </li>
        ))}
      </ul>
      {drafts.length === 0 && <p className='text-muted-foreground'>No proposal drafts yet.</p>}
    </PageContainer>
  );
}
