'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import {
  decideAdminAccess,
  markFlaggedCallReviewed,
  replayFailedWebhook,
  setOutboundKillSwitch,
  setOutboundPaused,
  suspendTenant
} from '@/server/admin';
import { isViewingAs } from '../view-as-guard';

async function adminOnly() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  return { userId: access.user.id, role: access.role as 'admin' };
}

export async function reviewFlaggedCallAction(formData: FormData) {
  const actor = await adminOnly();
  await markFlaggedCallReviewed(actor, {
    tenantId: String(formData.get('tenantId')),
    callId: String(formData.get('callId'))
  });
  revalidatePath('/admin/operations');
}

export async function setTenantKillSwitchAction(formData: FormData) {
  const actor = await adminOnly();
  await setOutboundKillSwitch(
    actor,
    String(formData.get('tenantId')),
    formData.get('enabled') === 'true'
  );
  revalidatePath('/admin/operations');
}

export async function replayWebhookAction(formData: FormData) {
  const actor = await adminOnly();
  await replayFailedWebhook(actor, String(formData.get('webhookId')));
  revalidatePath('/admin/operations');
}

export async function pauseOutboundAction(formData: FormData) {
  const actor = await adminOnly();
  await setOutboundPaused(actor, true, String(formData.get('reason') ?? ''));
  revalidatePath('/admin/operations');
}

export async function resumeOutboundAction() {
  const actor = await adminOnly();
  await setOutboundPaused(actor, false, '');
  revalidatePath('/admin/operations');
}

export async function suspendTenantAction(formData: FormData) {
  const actor = await adminOnly();
  await suspendTenant(
    actor,
    String(formData.get('tenantId')),
    formData.get('suspended') === 'true'
  );
  revalidatePath('/admin/operations');
  revalidatePath('/admin');
}
