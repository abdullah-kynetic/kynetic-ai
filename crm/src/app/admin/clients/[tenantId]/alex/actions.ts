'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { forbidden } from 'next/navigation';
import { decideAdminAccess, placeAdminTestCall, updateAdminAlexConfig } from '@/server/admin';
import { ValidationError } from '@/server/errors';

export async function updateAlexConfigAction(tenantId: string, formData: FormData) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  const prompt = String(formData.get('prompt') ?? '').trim();
  const provider = String(formData.get('provider') ?? '');
  if (provider === 'retell') throw new ValidationError({ provider: ['retell_parked'] });
  await updateAdminAlexConfig(
    { tenantId, userId: access.user.id },
    {
      ...(provider === 'elevenlabs' ? { provider: 'elevenlabs' as const } : {}),
      agentRef: String(formData.get('agentRef') ?? '').trim() || null,
      voice: String(formData.get('voice') ?? '').trim() || null,
      greeting: String(formData.get('greeting') ?? '').trim() || null,
      transferNumberE164: String(formData.get('transferNumberE164') ?? '').trim() || null,
      paused: formData.get('paused') === 'on',
      ...(prompt ? { prompt } : {})
    }
  );
  revalidatePath(`/admin/clients/${tenantId}/alex`);
}

export async function placeAlexTestCallAction(tenantId: string, formData: FormData) {
  const access = await decideAdminAccess(await headers());
  if (access.kind !== 'ok' || access.role !== 'admin') forbidden();
  await placeAdminTestCall(
    { tenantId, userId: access.user.id },
    String(formData.get('phone') ?? '')
  );
  revalidatePath(`/admin/clients/${tenantId}/alex`);
}
