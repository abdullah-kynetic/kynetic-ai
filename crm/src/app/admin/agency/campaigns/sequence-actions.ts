'use server';
import { revalidatePath } from 'next/cache';
import { agencyCaller } from '../caller';
import {
  setAgencyCampaignPlan,
  startAgencyCampaign,
  advanceAgencyCampaign
} from '@/server/agency/campaign-engine';
export async function saveSequence(id: string, form: FormData) {
  const steps = [0, 1, 2, 3]
    .filter((n) => form.get(`instructions${n}`))
    .map((n) => ({
      channel: String(form.get(`channel${n}`)),
      delayDays: Number(form.get(`delay${n}`)),
      instructions: String(form.get(`instructions${n}`))
    }));
  await setAgencyCampaignPlan(await agencyCaller(), id, steps);
  revalidatePath('/admin/agency/campaigns');
}
export async function enrollSequence(id: string) {
  await startAgencyCampaign(await agencyCaller(), id);
  revalidatePath('/admin/agency/campaigns');
}
export async function completeSequence(
  campaignId: string,
  contactId: string,
  stepIndex: number,
  mode: 'simulate' | 'manual_complete'
) {
  await advanceAgencyCampaign(await agencyCaller(), { campaignId, contactId, stepIndex, mode });
  revalidatePath('/admin/agency/campaigns');
}
