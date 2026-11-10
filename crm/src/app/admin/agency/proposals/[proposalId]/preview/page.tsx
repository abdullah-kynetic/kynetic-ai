import Link from 'next/link';
import { headers } from 'next/headers';
import { forbidden, notFound } from 'next/navigation';
import PageContainer from '@/components/agency/page';
import { decideAdminAccess } from '@/server/admin';
import { getAgencyProposal, PROPOSAL_SECTIONS } from '@/server/proposals';
import { PRICING_PLACEHOLDER } from '@/server/proposals/pdf';
import { ModuleDisabledError } from '@/server/modules';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../../view-as-guard';
export const dynamic = 'force-dynamic';
export default async function ProposalPreview({
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
  return (
    <PageContainer
      pageTitle={data.proposal.title}
      pageDescription={`Internal draft for ${data.dealTitle}`}
    >
      <style>{`@media print { .agency-navigation, .no-print { display: none !important; } }`}</style>
      <nav className='no-print mb-5 flex flex-wrap gap-4'>
        <Link
          href={`/admin/agency/proposals/${proposalId}`}
          className='inline-flex min-h-11 items-center underline'
        >
          Back to editor
        </Link>
        <a
          className='inline-flex min-h-11 items-center underline'
          href={`/api/admin/agency/proposals/${proposalId}/pdf`}
        >
          Download PDF
        </a>
        <Link
          href={`/admin/agency/contracts?deal=${data.proposal.dealId}`}
          className='inline-flex min-h-11 items-center underline'
        >
          Contract
        </Link>
      </nav>
      <article
        className='proposal-print max-w-3xl space-y-8 rounded border p-5 sm:p-8'
        aria-label='Proposal draft preview'
      >
        <p className='text-sm font-medium'>Kynetic AI · Draft for internal review</p>
        {PROPOSAL_SECTIONS.map((section) => (
          <section key={section.key} aria-labelledby={`preview-${section.key}`}>
            <h2 id={`preview-${section.key}`} className='mb-3 text-xl font-semibold'>
              {section.title}
            </h2>
            <p className='whitespace-pre-wrap break-words'>
              {data.proposal[section.key] || 'Not drafted yet.'}
            </p>
          </section>
        ))}
        <section aria-labelledby='preview-pricing'>
          <h2 id='preview-pricing' className='mb-3 text-xl font-semibold'>
            Pricing
          </h2>
          <p>{PRICING_PLACEHOLDER}</p>
        </section>
      </article>
    </PageContainer>
  );
}
