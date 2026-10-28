'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { decideAdminAccess, auditManualBackup } from '@/server/admin';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../view-as-guard';

export async function startBackup() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin' || (await isViewingAs(access.user)))
    throw new AppError('FORBIDDEN');
  await auditManualBackup({ userId: access.user.id, role: 'admin' });
  revalidatePath('/admin/backups');
}
