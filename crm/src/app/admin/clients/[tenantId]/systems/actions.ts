'use server';

import { AppError } from '@/server/errors';
import { setFollowupBundle, setTenantModule } from '@/server/modules/admin';
import { setTenantAutomation } from '@/server/admin/system-settings';
import { decideAdminAccess } from '@/server/admin';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { isViewingAs } from '../../../view-as-guard';

export type ToggleResult = { ok: true; changed: boolean } | { ok: false; message: string };

async function adminActor() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin')
    return { ok: false as const, message: 'Only a Kynetic admin can change systems.' };
  if (await isViewingAs(access.user))
    return { ok: false as const, message: 'Exit view-as before changing systems.' };
  return { ok: true as const, access };
}

function refresh(tenantId: string) {
  revalidatePath(`/admin/clients/${tenantId}/systems`);
  revalidatePath(`/admin/clients/${tenantId}`);
  revalidatePath('/dashboard', 'layout');
}

/**
 * Switches a system for one client. The admin guard runs again here: a server action is a public
 * endpoint. Only a Kynetic admin passes.
 */
export async function toggleModule(input: {
  tenantId: string;
  moduleKey: string;
  enabled: boolean;
  level?: string;
}): Promise<ToggleResult> {
  const actor = await adminActor();
  if (!actor.ok) return actor;
  try {
    const result =
      input.moduleKey === 'followup_bundle'
        ? await setFollowupBundle(
            { id: actor.access.user.id, kyneticRole: actor.access.role },
            { tenantId: input.tenantId, enabled: input.enabled }
          )
        : await setTenantModule(
            { id: actor.access.user.id, kyneticRole: actor.access.role },
            input as Parameters<typeof setTenantModule>[1]
          );
    refresh(input.tenantId);
    return { ok: true, changed: result.changed };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    throw error;
  }
}

export async function setAutomation(input: {
  tenantId: string;
  templateKey: string;
  enabled: boolean;
}): Promise<ToggleResult> {
  const actor = await adminActor();
  if (!actor.ok) return actor;
  try {
    const result = await setTenantAutomation(
      { id: actor.access.user.id, kyneticRole: actor.access.role },
      input
    );
    refresh(input.tenantId);
    return { ok: true, changed: result.changed };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    throw error;
  }
}
