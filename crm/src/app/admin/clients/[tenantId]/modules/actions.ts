'use server';

import { AppError } from '@/server/errors';
import { setTenantModule } from '@/server/modules/admin';
import { decideAdminAccess } from '@/server/admin';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type ToggleResult = { ok: true; changed: boolean } | { ok: false; message: string };

/**
 * Switches a module for one client (F-70, F-85). The admin guard runs again here: a server action is
 * a public endpoint whatever page renders it. Only a Kynetic admin passes; a VA is refused.
 */
export async function toggleModule(input: {
  tenantId: string;
  moduleKey: string;
  enabled: boolean;
  level?: string;
}): Promise<ToggleResult> {
  const requestHeaders = await headers();
  const access = await decideAdminAccess(requestHeaders);
  if (access.kind !== 'ok' || access.role !== 'admin')
    return { ok: false, message: 'Only a Kynetic admin can change modules.' };
  try {
    const result = await setTenantModule(
      { id: access.user.id, kyneticRole: access.role },
      input as Parameters<typeof setTenantModule>[1]
    );
    revalidatePath(`/admin/clients/${input.tenantId}/modules`);
    return { ok: true, changed: result.changed };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message };
    throw e;
  }
}
