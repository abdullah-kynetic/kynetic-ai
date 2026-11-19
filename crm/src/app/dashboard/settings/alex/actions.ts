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
import { audit } from '@/server/audit';
import { AppError } from '@/server/errors';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { submitSupportRequest } from '@/server/support';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
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

/** Files a support request. The raw prompt is not part of the form and is not shown. */
export async function requestAlexChangeAction(form: FormData) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()]);
  const shell = await loadShellContext(
    requestHeaders,
    cookieStore.get('tenant_id')?.value,
    undefined,
    cookieStore.get(VIEW_AS_COOKIE)?.value
  );
  if (!shell?.tenant) redirect('/sign-in');
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  if (shell.viewAs?.readOnly) {
    await withTenant(ctx, (tx) =>
      audit(tx, { action: 'viewas.write_denied', entity: 'support_request' })
    );
    redirect('/dashboard/settings/alex?error=read-only');
  }
  const user = await getSessionUser(requestHeaders);
  if (!user) redirect('/sign-in');
  const actor = await resolveActor(user, shell.tenant.id);
  if (!can(actor, 'alex.settings.client', shell.tenant.id))
    redirect('/dashboard/settings/alex?error=permission');
  try {
    const created = await submitSupportRequest(ctx, actor, {
      subject: 'Change how Alex works',
      body: String(form.get('body') ?? ''),
      category: 'alex_change'
    });
    redirect(`/dashboard/support/${created.id}`);
  } catch (error) {
    if (error instanceof AppError) redirect('/dashboard/settings/alex?error=invalid');
    throw error;
  }
}
