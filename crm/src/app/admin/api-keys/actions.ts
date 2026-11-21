'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { decideAdminAccess } from '@/server/admin';
import { issueAdminKey, revokeAdminKey, setServiceApiEnabled } from '@/server/admin/admin-api-keys';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../view-as-guard';

const OWNER_ONLY = 'Only the portal owner can manage API keys.';

async function ownerCaller() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin')
    return { ok: false as const, message: OWNER_ONLY };
  if (await isViewingAs(access.user))
    return { ok: false as const, message: 'Exit view-as before managing API keys.' };
  return { ok: true as const, caller: { id: access.user.id, kyneticRole: access.role } };
}

function fail(error: unknown, fallback: string) {
  if (error instanceof AppError && error.code === 'VALIDATION_FAILED')
    return { ok: false as const, message: error.message };
  if (error instanceof AppError && error.code === 'FORBIDDEN')
    return { ok: false as const, message: OWNER_ONLY };
  return { ok: false as const, message: fallback };
}

export async function issueAdminKeyAction(input: {
  label: string;
  allowedCidrs: string[];
}): Promise<{ ok: true; id: string; key: string } | { ok: false; message: string }> {
  const access = await ownerCaller();
  if (!access.ok) return access;
  try {
    const issued = await issueAdminKey(access.caller, input);
    revalidatePath('/admin/api-keys');
    return { ok: true, ...issued };
  } catch (error) {
    return fail(error, 'The key could not be issued.');
  }
}

export async function revokeAdminKeyAction(
  id: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await ownerCaller();
  if (!access.ok) return access;
  try {
    await revokeAdminKey(access.caller, id);
    revalidatePath('/admin/api-keys');
    return { ok: true };
  } catch (error) {
    return fail(error, 'The key could not be revoked.');
  }
}

export async function setServiceApiEnabledAction(
  enabled: boolean
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await ownerCaller();
  if (!access.ok) return access;
  try {
    await setServiceApiEnabled(access.caller, enabled);
    revalidatePath('/admin/api-keys');
    return { ok: true };
  } catch (error) {
    return fail(error, 'The switch could not be changed.');
  }
}
