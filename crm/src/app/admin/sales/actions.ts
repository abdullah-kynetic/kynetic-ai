'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getEnv } from '@/server/env';
import {
  decideAdminAccess,
  getInviteMailer,
  moveClientLifecycle,
  sendOwnerInvite
} from '@/server/admin';
import { moveAgencyDeal } from '@/server/agency';
import { setDealColumn } from '@/server/agency/pipeline';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../view-as-guard';

export async function moveSalesDealAction(dealId: string, stageId: string, lostReason?: string) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user))) {
    return { ok: false, message: 'Only a Kynetic admin can move deals.' } as const;
  }
  try {
    await moveAgencyDeal({ id: access.user.id, kyneticRole: 'admin' }, dealId, stageId, {
      lostReason
    });
    revalidatePath('/admin/sales');
    return { ok: true } as const;
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message } as const;
    return { ok: false, message: 'Could not save the stage. Try again.' } as const;
  }
}

async function pipelineCaller() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    throw new AppError('FORBIDDEN', { message: 'Only a Kynetic admin can move deals.' });
  return { id: access.user.id, kyneticRole: 'admin' as const };
}

async function adminPlatform() {
  const c = await pipelineCaller();
  return { userId: c.id, role: 'admin' as const };
}

/** Moves a deal between Audit pending and Proposal, or declines it (the reason is required). */
export async function setDealColumnAction(
  dealId: string,
  to: 'audit_pending' | 'proposal' | 'declined',
  formData: FormData
) {
  const reason = String(formData.get('reason') ?? '');
  await setDealColumn(await pipelineCaller(), dealId, to, { reason });
  revalidatePath('/admin/sales');
  revalidatePath('/admin/sales/leads');
}

/** Contract signed and deposit paid: the Proposal account moves to Building. Sends nothing. */
export async function startBuildingAction(tenantId: string) {
  await moveClientLifecycle(await adminPlatform(), tenantId, 'building');
  revalidatePath('/admin/sales');
  revalidatePath('/admin/clients');
}

/** Emails the owner their one-time sign-in link, only when the admin presses the button. */
export async function sendInviteAction(tenantId: string) {
  const caller = await pipelineCaller();
  const mailer = getInviteMailer();
  let result: 'sent' | 'not_connected' | 'failed' = 'sent';
  if (!mailer) result = 'not_connected';
  else {
    try {
      await sendOwnerInvite({ userId: caller.id, role: 'admin' }, tenantId, {
        email: mailer.provider,
        fromAddress: mailer.fromAddress,
        baseUrl: getEnv().APP_BASE_URL
      });
    } catch {
      result = 'failed';
    }
  }
  redirect(`/admin/sales?invite=${result}`);
}
