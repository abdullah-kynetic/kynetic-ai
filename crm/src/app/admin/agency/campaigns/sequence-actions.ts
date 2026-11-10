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
  mode: 'simulate' | 'manual_complete' | 'done'
) {
  await advanceAgencyCampaign(await agencyCaller(), { campaignId, contactId, stepIndex, mode });
  revalidatePath('/admin/agency/campaigns');
}
export async function skipSequence(
  campaignId: string,
  contactId: string,
  stepIndex: number,
  form: FormData
) {
  await advanceAgencyCampaign(await agencyCaller(), {
    campaignId,
    contactId,
    stepIndex,
    mode: 'skip',
    reason: String(form.get('reason') ?? '')
  });
  revalidatePath('/admin/agency/campaigns');
}
export async function rescheduleSequence(
  campaignId: string,
  contactId: string,
  stepIndex: number,
  form: FormData
) {
  await advanceAgencyCampaign(await agencyCaller(), {
    campaignId,
    contactId,
    stepIndex,
    mode: 'reschedule',
    callbackDate: String(form.get('callbackDate') ?? ''),
    callbackTime: String(form.get('callbackTime') ?? '')
  });
  revalidatePath('/admin/agency/campaigns');
}
