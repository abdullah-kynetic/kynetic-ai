'use server';

import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { decideAdminAccess } from '@/server/admin';
import { issueAdminServiceToken, revokeAdminServiceToken } from '@/server/admin/service-tokens';
import { AppError } from '@/server/errors';
import { isViewingAs } from '../../../view-as-guard';

async function adminCaller() {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin')
    return { ok: false as const, message: 'Only a Kynetic admin can manage service tokens.' };
  if (await isViewingAs(access.user))
    return { ok: false as const, message: 'Exit view-as before managing service tokens.' };
  return { ok: true as const, caller: { id: access.user.id, kyneticRole: access.role } };
}

export async function issueServiceTokenAction(
  tenantId: string,
  input: { label: string; scopes: string[] }
): Promise<{ ok: true; id: string; token: string } | { ok: false; message: string }> {
  const access = await adminCaller();
  if (!access.ok) return access;
  try {
    const issued = await issueAdminServiceToken(access.caller, tenantId, input);
    revalidatePath(`/admin/clients/${tenantId}/service-tokens`);
    return { ok: true, id: issued.id, token: issued.token };
  } catch (error) {
    if (error instanceof AppError && error.code === 'VALIDATION_FAILED')
      return { ok: false, message: error.message };
    return { ok: false, message: 'The token could not be issued.' };
  }
}

export async function revokeServiceTokenAction(
  tenantId: string,
  tokenId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const access = await adminCaller();
  if (!access.ok) return access;
  try {
    await revokeAdminServiceToken(access.caller, tenantId, tokenId);
    revalidatePath(`/admin/clients/${tenantId}/service-tokens`);
    return { ok: true };
  } catch {
    return { ok: false, message: 'The token could not be revoked.' };
  }
}
