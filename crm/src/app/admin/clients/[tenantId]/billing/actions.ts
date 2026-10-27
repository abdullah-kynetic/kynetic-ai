'use server';

import { setTenantPlanTier, snapshotModulePrice, updateBillingProfile } from '@/server/billing';
import { decideAdminAccess } from '@/server/admin';
import { AppError } from '@/server/errors';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type BillingResult = { ok: true } | { ok: false; message: string };

/**
 * Billing actions (F-86, F-99). Each one re-runs the admin guard: a server action is a public
 * endpoint whatever page renders it. Only a Kynetic admin passes; a VA, owner or staff user is refused.
 */
async function run(
  tenantId: string,
  fn: (actor: { id: string; kyneticRole: 'admin' }) => Promise<void>
): Promise<BillingResult> {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin')
    return { ok: false, message: 'Only a Kynetic admin can change billing.' };
  try {
    await fn({ id: access.user.id, kyneticRole: 'admin' });
    revalidatePath(`/admin/clients/${tenantId}/billing`);
    return { ok: true };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, message: e.message };
    throw e;
  }
}

export async function savePlanTier(
  input: Parameters<typeof setTenantPlanTier>[1]
): Promise<BillingResult> {
  return run(input.tenantId, (actor) => setTenantPlanTier(actor, input));
}

export async function saveBillingProfile(
  input: Parameters<typeof updateBillingProfile>[1]
): Promise<BillingResult> {
  return run(input.tenantId, (actor) => updateBillingProfile(actor, input));
}

export async function resnapshotModule(
  input: Parameters<typeof snapshotModulePrice>[1]
): Promise<BillingResult> {
  return run(input.tenantId, (actor) => snapshotModulePrice(actor, input));
}
