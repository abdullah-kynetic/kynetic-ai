'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { decideAdminAccess } from '@/server/admin';
import { moveAgencyDeal } from '@/server/agency';
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
