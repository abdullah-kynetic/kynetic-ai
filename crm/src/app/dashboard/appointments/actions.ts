'use server';

import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers';
import { bookAppointment, cancelAppointment, updateAppointment } from '@/server/appointments';
import { loadShellContext } from '@/server/shell';

async function context() {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const shell = await loadShellContext(h, c.get('tenant_id')?.value);
  if (!shell?.tenant) throw new Error('unauthorized');
  return { shell, ctx: { tenantId: shell.tenant.id, userId: shell.user.id, role: shell.role } };
}

export async function rescheduleAppointment(id: string, startsAt: string, endsAt: string) {
  const { ctx } = await context();
  await updateAppointment(ctx, id, { startsAt: new Date(startsAt), endsAt: new Date(endsAt) });
  revalidatePath('/dashboard/appointments');
}

export async function rescheduleAppointmentForm(id: string, form: FormData) {
  await rescheduleAppointment(id, String(form.get('startsAt')), String(form.get('endsAt')));
}

export async function createAppointmentAction(form: FormData) {
  const { ctx } = await context();
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
  const { ctx } = await context();
  await cancelAppointment(ctx, id);
  revalidatePath('/dashboard/appointments');
}
