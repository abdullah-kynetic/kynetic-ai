'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { decideAdminAccess } from '@/server/admin';
import { isLifecycleStage, moveClientLifecycle } from '@/server/admin';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../view-as-guard';

export async function moveClientStageAction(tenantId: string, stage: string) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user))) {
    return { ok: false, message: 'Only a Kynetic admin can move clients.' } as const;
  }
  if (!isLifecycleStage(stage)) return { ok: false, message: 'Unknown client stage.' } as const;
  try {
    await moveClientLifecycle({ userId: access.user.id, role: 'admin' }, tenantId, stage);
    revalidatePath('/admin/clients');
    return { ok: true } as const;
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message } as const;
    return { ok: false, message: 'Could not save the stage. Try again.' } as const;
  }
}
