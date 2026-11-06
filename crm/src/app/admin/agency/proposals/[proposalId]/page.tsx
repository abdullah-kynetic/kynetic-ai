import Link from 'next/link';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/agency/page';
import { decideAdminAccess } from '@/server/admin';
import { getAgencyProposal } from '@/server/proposals';
import { ModuleDisabledError } from '@/server/modules';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';
import { ProposalEditor } from './editor';
export const dynamic = 'force-dynamic';
export default async function ProposalPage({
  params
}: {
  params: Promise<{ proposalId: string }>;
}) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  const { proposalId } = await params;
  const data = await getAgencyProposal(
    { id: access.user.id, kyneticRole: access.role },
    proposalId
  ).catch((error: unknown) => {
    if (error instanceof ModuleDisabledError) forbidden();
    if (
      error instanceof AppError &&
      (error.code === 'NOT_FOUND' || error.code === 'VALIDATION_FAILED')
    )
      notFound();
    throw error;
  });
  const { id, revision, title, problem, solution, roadmap, roi } = data.proposal;
  return (
    <PageContainer
      pageTitle='Edit proposal draft'
      pageDescription={`Agency deal: ${data.dealTitle}`}
    >
      <nav aria-label='Proposal navigation' className='mb-5 flex flex-wrap gap-4'>
        <Link
          href='/admin/agency/proposals'
          className='inline-flex min-h-11 items-center underline'
        >
          All drafts
        </Link>
        <Link
          href={`/admin/agency/proposals/${proposalId}/preview`}
          className='inline-flex min-h-11 items-center underline'
        >
          Preview saved draft
        </Link>
      </nav>
      <p className='mb-6 rounded border p-3'>
        Internal draft · Nothing is sent or published. Preview shows the last saved content.
      </p>
      <ProposalEditor key={id} draft={{ id, revision, title, problem, solution, roadmap, roi }} />
    </PageContainer>
  );
}
