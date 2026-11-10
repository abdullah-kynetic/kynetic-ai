'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { bookAppointment, cancelAppointment, updateAppointment } from '@/server/appointments';
import { searchContacts } from '@/server/contacts';
import { audit } from '@/server/audit';
import { getDb } from '@/server/db/client';
import { AppError, RateLimitedError } from '@/server/errors';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { enforceSearchRateLimit } from '@/server/security/rate-limit';
import { loadShellContext } from '@/server/shell';
import { withTenant } from '@/server/tenancy';

async function context() {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const shell = await loadShellContext(
    h,
    c.get('tenant_id')?.value,
    undefined,
    c.get(VIEW_AS_COOKIE)?.value
  );
  if (!shell?.tenant) throw new Error('unauthorized');
  const ctx = { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role };
  return { shell, ctx };
}

async function refuseViewAsWrite(
  shell: Awaited<ReturnType<typeof context>>['shell'],
  ctx: Awaited<ReturnType<typeof context>>['ctx']
) {
  if (!shell.viewAs?.readOnly) return;
  await withTenant(ctx, (tx) =>
    audit(tx, { action: 'viewas.write_denied', entity: 'appointment' })
  );
  throw new AppError('FORBIDDEN');
}

export async function searchAppointmentContacts(
  query: string
): Promise<
  | { ok: true; results: { id: string; name: string; phone: string | null }[] }
  | { ok: false; error: string }
> {
  const { shell, ctx } = await context();
  try {
    await enforceSearchRateLimit(getDb(), shell.user.id);
  } catch (error) {
    if (error instanceof RateLimitedError)
      return { ok: false, error: 'Too many searches. Try again shortly.' };
    throw error;
  }
  const q = query.trim();
  if (q.length < 2) return { ok: true, results: [] };
  const result = await searchContacts(ctx, { q, perPage: 10 });
  return {
    ok: true,
    results: result.rows.map((row) => ({
      id: row.id,
      name: [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unnamed contact',
      phone: row.primaryPhoneE164
    }))
  };
}

export async function rescheduleAppointment(id: string, startsAt: string, endsAt: string) {
  const { shell, ctx } = await context();
  await refuseViewAsWrite(shell, ctx);
  await updateAppointment(ctx, id, { startsAt: new Date(startsAt), endsAt: new Date(endsAt) });
  revalidatePath('/dashboard/appointments');
}

export async function rescheduleAppointmentForm(id: string, form: FormData) {
  await rescheduleAppointment(id, String(form.get('startsAt')), String(form.get('endsAt')));
}

export async function createAppointmentAction(form: FormData) {
  const { shell, ctx } = await context();
  await refuseViewAsWrite(shell, ctx);
  await bookAppointment(
    ctx,
    {
      contactId: String(form.get('contactId') || '') || null,
      dealId: String(form.get('dealId') || '') || null,
      startsAt: new Date(String(form.get('startsAt'))),
      endsAt: new Date(String(form.get('endsAt'))),
      notes: String(form.get('notes') || '') || null
    },
    { bookedBy: 'user' }
  );
  revalidatePath('/dashboard/appointments');
}

export async function cancelAppointmentAction(id: string) {
  const { shell, ctx } = await context();
  await refuseViewAsWrite(shell, ctx);
  await cancelAppointment(ctx, id);
  revalidatePath('/dashboard/appointments');
}
