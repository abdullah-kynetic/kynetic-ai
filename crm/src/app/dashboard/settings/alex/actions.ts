'use server';

import { can, getSessionUser, resolveActor } from '@/server/auth';
import {
  AlexConfigMissingError,
  clientAlexUpdateSchema,
  updateClientAlexSettings
} from '@/server/alex';
import { requireModule } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import { withTenant } from '@/server/tenancy';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type AlexSettingsState = { error?: string; saved?: boolean };

/** Owner saves pause and call hours. Anything else in the form is ignored; the schema is strict. */
export async function saveAlexSettings(
  _prev: AlexSettingsState,
  formData: FormData
): Promise<AlexSettingsState> {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(requestHeaders, cookieStore.get('tenant_id')?.value);
  if (!shell?.tenant) return { error: 'Sign in again to continue.' };
  const ctx = {
    tenantId: shell.tenant.id,
    userId: shell.user.id,
    role: shell.role
  };
  await requireModule(ctx, 'alex_core');

  const user = await getSessionUser(requestHeaders);
  if (!user) return { error: 'Sign in again to continue.' };
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, 'alex.settings.client', shell.tenant.id)) {
    return { error: 'You do not have permission to change Alex settings.' };
  }

  const parsed = clientAlexUpdateSchema.safeParse({
    paused: formData.get('paused') === 'on',
    callWindows: { start: formData.get('start'), end: formData.get('end') }
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Check the values.' };

  try {
    await withTenant(ctx, (tx) => updateClientAlexSettings(tx, parsed.data, shell.user.id));
  } catch (e) {
    if (e instanceof AlexConfigMissingError) return { error: e.message };
    throw e;
  }
  revalidatePath('/dashboard/settings/alex');
  return { saved: true };
}
