'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { forbidden, redirect } from 'next/navigation';
import { AppError } from '@/server/errors';
import { decideAdminAccess } from '@/server/admin';
import {
  createAgencyLead,
  getAgencyWorkspace,
  moveAgencyDeal,
  renameAgencyStage
} from '@/server/agency';
import { isViewingAs } from '../view-as-guard';

async function caller() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  if (await isViewingAs(access.user)) forbidden();
  return { id: access.user.id, kyneticRole: access.role };
}
async function change(fn: () => Promise<unknown>) {
  let invalid = false;
  try {
    await fn();
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    invalid = true;
  }
  revalidatePath('/admin/agency');
  if (invalid) redirect('/admin/agency?error=invalid');
}
export async function createAgencyWorkspaceAction() {
  await change(async () => getAgencyWorkspace(await caller(), true));
}
export async function createAgencyLeadAction(form: FormData) {
  const [direction, channel] = String(form.get('source') ?? '').split(':');
  await change(async () =>
    createAgencyLead(await caller(), {
      firstName: String(form.get('firstName') ?? ''),
      email: String(form.get('email') ?? ''),
      ...(String(form.get('phone') ?? '').trim()
        ? { phone: String(form.get('phone')).trim() }
        : {}),
      ...(String(form.get('state') ?? '').trim()
        ? { state: String(form.get('state')).trim() }
        : {}),
      direction,
      channel
    })
  );
}
export async function renameAgencyStageAction(stageId: string, form: FormData) {
  await change(async () =>
    renameAgencyStage(await caller(), stageId, String(form.get('name') ?? ''))
  );
}
export async function moveAgencyDealAction(dealId: string, form: FormData) {
  await change(async () =>
    moveAgencyDeal(await caller(), dealId, String(form.get('stageId') ?? ''), {
      lostReason: String(form.get('lostReason') ?? '').trim() || undefined
    })
  );
}
