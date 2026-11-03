'use server';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { forbidden, redirect } from 'next/navigation';
import { decideAdminAccess } from '@/server/admin';
import { assignAgencyCampaign, createAgencyCampaign } from '@/server/agency/campaigns';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../view-as-guard';
async function caller() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  return { id: access.user.id, kyneticRole: access.role };
}
export async function createCampaignAction(form: FormData) {
  const actor = await caller();
  let invalid = false;
  try {
    await createAgencyCampaign(actor, {
      name: String(form.get('name') ?? ''),
      script: String(form.get('script') ?? '')
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    invalid = true;
  }
  revalidatePath('/admin/agency/campaigns');
  if (invalid) redirect('/admin/agency/campaigns?error=invalid');
}
export async function assignCampaignAction(campaignId: string, form: FormData) {
  await assignAgencyCampaign(await caller(), campaignId, String(form.get('contactId') ?? ''));
  revalidatePath('/admin/agency/campaigns');
  revalidatePath('/admin/agency/dialer');
}
