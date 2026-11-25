'use server';

import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { audit } from '@/server/audit';
import { AppError } from '@/server/errors';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { loadShellContext } from '@/server/shell';
import { AwayValidationError, saveAwaySettings, type AwaySettings } from '@/server/shop';
import { withTenant } from '@/server/tenancy';

export type AwayState = {
  saved?: boolean;
  errors?: Record<string, string>;
  /** What was submitted, so a refused save does not wipe the form. */
  values?: AwaySettings;
};

const day = (v: FormDataEntryValue | null) => (typeof v === 'string' && v ? v : null);

/** Saves away mode as a setting. Nothing is sent, paused or changed outside the portal. */
export async function saveAwayAction(_prev: AwayState, form: FormData): Promise<AwayState> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const shell = await loadShellContext(
    h,
    c.get('tenant_id')?.value,
    undefined,
    c.get(VIEW_AS_COOKIE)?.value
  );
  if (!shell?.tenant) throw new Error('unauthorized');
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  if (shell.viewAs?.readOnly) {
    await withTenant(ctx, (tx) => audit(tx, { action: 'viewas.write_denied', entity: 'tenant' }));
    throw new AppError('FORBIDDEN');
  }
  const values: AwaySettings = {
    enabled: form.get('enabled') === 'on',
    from: day(form.get('from')),
    until: day(form.get('until')),
    dailySummary: form.get('dailySummary') === 'on',
    alerts: {
      urgentCalls: form.get('urgentCalls') === 'on',
      quoteReplies: form.get('quoteReplies') === 'on',
      pickupsWaiting: form.get('pickupsWaiting') === 'on'
    }
  };
  try {
    await saveAwaySettings(ctx, values);
  } catch (error) {
    if (error instanceof AwayValidationError) return { errors: error.fieldErrors, values };
    throw error;
  }
  revalidatePath('/dashboard/shop/away');
  return { saved: true, values };
}
