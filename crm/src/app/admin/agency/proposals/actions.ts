'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { forbidden, redirect } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { openAgencyProposal, saveAgencyProposal } from '@/server/proposals';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../view-as-guard';

export type ProposalSaveState = { revision: number; ok: boolean; message: string };
async function caller() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  return { id: access.user.id, kyneticRole: access.role };
}
export async function openProposalAction(form: FormData) {
  const actor = await caller();
  let id: string | null = null;
  try {
    id = (await openAgencyProposal(actor, String(form.get('dealId') ?? ''))).id;
  } catch (error) {
    if (!(error instanceof AppError)) console.error('Proposal draft creation failed');
  }
  if (!id) redirect('/admin/agency/proposals?error=unavailable');
  revalidatePath('/admin/agency/proposals');
  redirect(`/admin/agency/proposals/${id}`);
}
export async function saveProposalAction(
  proposalId: string,
  previous: ProposalSaveState,
  form: FormData
): Promise<ProposalSaveState> {
  const actor = await caller();
  const expectedRevision = Number(form.get('expectedRevision'));
  try {
    const saved = await saveAgencyProposal(actor, proposalId, {
      title: String(form.get('title') ?? ''),
      problem: String(form.get('problem') ?? ''),
      solution: String(form.get('solution') ?? ''),
      roadmap: String(form.get('roadmap') ?? ''),
      roi: String(form.get('roi') ?? ''),
      expectedRevision
    });
    revalidatePath('/admin/agency/proposals');
    revalidatePath(`/admin/agency/proposals/${proposalId}`);
    revalidatePath(`/admin/agency/proposals/${proposalId}/preview`);
    return { revision: saved.revision, ok: true, message: 'Draft saved.' };
  } catch (error) {
    const conflict = error instanceof AppError && error.code === 'CONFLICT';
    if (!(error instanceof AppError)) console.error('Proposal draft save failed');
    return {
      revision: previous?.revision ?? 1,
      ok: false,
      message: conflict
        ? 'A newer draft was saved elsewhere. Your text is still here. Copy it before refreshing to review the newer version.'
        : 'The draft could not be saved. Check the title and section lengths, then try again.'
    };
  }
}
