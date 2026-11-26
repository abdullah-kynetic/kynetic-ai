'use server';

import { decideAdminAccess } from '@/server/admin';
import {
  AUTO_BODY_SYSTEMS,
  BUILD_STAGES,
  removeBuildSystem,
  saveBuildSystem
} from '@/server/admin/build-systems';
import { isLifecycleStage, moveClientLifecycle } from '@/server/admin/client-lifecycle';
import { AppError } from '@/server/errors';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isViewingAs } from '../../../view-as-guard';

async function admin() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    throw new AppError('FORBIDDEN', {
      message: 'Only a Kynetic admin can change the build.'
    });
  return { userId: access.user.id, role: 'admin' as const };
}

function refresh(tenantId: string) {
  revalidatePath(`/admin/clients/${tenantId}/build`);
  revalidatePath('/admin/clients');
  revalidatePath('/dashboard', 'layout');
}

export async function saveSystemAction(tenantId: string, formData: FormData) {
  const ctx = await admin();
  const name = String(formData.get('name') ?? '').trim();
  const key =
    String(formData.get('key') ?? '').trim() ||
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60);
  await saveBuildSystem(ctx, tenantId, {
    key,
    name,
    outcome: String(formData.get('outcome') ?? ''),
    stage: String(formData.get('stage') ?? 'planned') as (typeof BUILD_STAGES)[number],
    note: String(formData.get('note') ?? ''),
    sortOrder: Number(formData.get('sortOrder') ?? 0) || 0
  });
  refresh(tenantId);
}

export async function removeSystemAction(tenantId: string, key: string) {
  await removeBuildSystem(await admin(), tenantId, key);
  refresh(tenantId);
}

/** Adds the five auto body systems as Planned. Existing systems with the same key are left alone by the caller. */
export async function loadAutoBodyAction(tenantId: string) {
  const ctx = await admin();
  for (const s of AUTO_BODY_SYSTEMS)
    await saveBuildSystem(ctx, tenantId, { ...s, stage: 'planned' });
  refresh(tenantId);
}

export async function moveStageAction(tenantId: string, formData: FormData) {
  const stage = String(formData.get('stage'));
  if (!isLifecycleStage(stage)) throw new AppError('VALIDATION_FAILED');
  await moveClientLifecycle(await admin(), tenantId, stage);
  refresh(tenantId);
}
