'use server';

import { decideAdminAccess } from '@/server/admin';
import { setGuaranteeBaseline } from '@/server/admin/client-overview';
import { AppError } from '@/server/errors';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { isViewingAs } from '../../view-as-guard';

export type GuaranteeState = { status: 'idle' | 'saved' } | { status: 'error'; message: string };

export async function saveGuaranteeBaseline(
  _state: GuaranteeState,
  form: FormData
): Promise<GuaranteeState> {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin')
    return { status: 'error', message: 'Only a Kynetic admin can set the guarantee baseline.' };
  if (await isViewingAs(access.user))
    return { status: 'error', message: 'Exit view-as before changing a client.' };
  const tenantId = String(form.get('tenantId') ?? '');
  const startRaw = String(form.get('startDate') ?? '').trim();
  const baselineRaw = String(form.get('baseline') ?? '').trim();
  const baseline = baselineRaw === '' ? null : Number(baselineRaw);
  if (baseline !== null && (!Number.isInteger(baseline) || baseline < 0))
    return {
      status: 'error',
      message: 'Enter a whole number of booked appointments, or leave it blank.'
    };
  try {
    await setGuaranteeBaseline(
      { id: access.user.id, kyneticRole: access.role },
      { tenantId, baseline, startDate: startRaw === '' ? null : startRaw }
    );
  } catch (error) {
    if (error instanceof AppError) return { status: 'error', message: error.message };
    throw error;
  }
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath('/dashboard');
  return { status: 'saved' };
}
