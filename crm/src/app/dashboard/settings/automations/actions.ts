'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { stageScope } from '@/server/deals';
import {
  approveAutomationEdit,
  proposeAutomationEdit,
  rejectAutomationEdit,
  setAutomationEnabled
} from '@/server/automations';

export async function toggleAutomation(key: string, enabled: boolean) {
  const { ctx, actor } = await stageScope(await headers());
  await setAutomationEnabled(ctx, actor, key as never, enabled, {
    keys: new Set(['platform', 'alex_core', 'crm']),
    crmLevel: 'full'
  });
  revalidatePath('/dashboard/settings/automations');
}

function readSteps(form: FormData) {
  const steps: { channel: 'sms'; delayMinutes: number; body: string }[] = [];
  for (let i = 1; i <= 6; i++) {
    const body = String(form.get(`body_${i}`) ?? '').trim();
    if (!body) continue;
    const hours = Number(form.get(`delay_hours_${i}`) ?? 0);
    steps.push({
      channel: 'sms',
      delayMinutes: Math.round((Number.isFinite(hours) ? hours : 0) * 60),
      body
    });
  }
  return steps;
}

export async function proposeEdit(key: string, form: FormData) {
  const { ctx, actor } = await stageScope(await headers());
  await proposeAutomationEdit(ctx, actor, key, readSteps(form));
  revalidatePath('/dashboard/settings/automations');
}

export async function decideEdit(versionId: string, approve: boolean) {
  const { ctx, actor } = await stageScope(await headers());
  if (approve) await approveAutomationEdit(ctx, actor, versionId);
  else await rejectAutomationEdit(ctx, actor, versionId);
  revalidatePath('/dashboard/settings/automations');
}
