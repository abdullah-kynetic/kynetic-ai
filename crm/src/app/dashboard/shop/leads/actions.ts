'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { audit } from '@/server/audit';
import { createContact, DuplicateContactError } from '@/server/contacts';
import { normalizePhone } from '@/server/contacts/phone';
import { listFieldDefs } from '@/server/custom-fields';
import { createDeal } from '@/server/deals';
import { AppError } from '@/server/errors';
import { VIEW_AS_COOKIE } from '@/server/impersonation';
import { requireModule } from '@/server/modules';
import { loadShellContext } from '@/server/shell';
import { withTenant } from '@/server/tenancy';

export type WalkInState = {
  error?: string;
  fieldErrors?: Partial<Record<'name' | 'phone' | 'year', string>>;
  values?: Record<string, string>;
};

const text = (v: FormDataEntryValue | null) => (typeof v === 'string' ? v.trim() : '');

const schema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(1),
  year: z.string().regex(/^(\d{4})?$/),
  make: z.string().max(60),
  model: z.string().max(60)
});

/**
 * Adds a walk-in: a real contact and a job in the first stage. It is created as a contact, not as a
 * lead event, so nothing is dialed or texted. A person is standing at the counter.
 */
export async function addWalkIn(_prev: WalkInState, form: FormData): Promise<WalkInState> {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const shell = await loadShellContext(
    h,
    c.get('tenant_id')?.value,
    undefined,
    c.get(VIEW_AS_COOKIE)?.value
  );
  if (!shell?.tenant) throw new Error('unauthorized');
  const ctx = {
    tenantId: shell.tenant.id,
    userId: shell.user.id,
    role: shell.role
  };
  await requireModule(ctx, 'shop_ops');
  if (shell.viewAs?.readOnly) {
    await withTenant(ctx, (tx) => audit(tx, { action: 'viewas.write_denied', entity: 'contact' }));
    throw new AppError('FORBIDDEN');
  }
  const values = {
    name: text(form.get('name')),
    phone: text(form.get('phone')),
    year: text(form.get('year')),
    make: text(form.get('make')),
    model: text(form.get('model'))
  };
  const parsed = schema.safeParse(values);
  const phone = normalizePhone(values.phone);
  const fieldErrors: NonNullable<WalkInState['fieldErrors']> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]) as 'name' | 'phone' | 'year';
      if (key === 'name') fieldErrors.name = 'Enter the customer name.';
      if (key === 'year') fieldErrors.year = 'Enter a four-digit year, or leave it empty.';
    }
  }
  if (!phone) fieldErrors.phone = 'Enter a valid phone number.';
  if (Object.keys(fieldErrors).length) return { fieldErrors, values };

  const [first, ...rest] = values.name.split(/\s+/);
  let contactId: string;
  try {
    const contact = await createContact(ctx, {
      firstName: first!,
      lastName: rest.join(' ') || undefined,
      phones: [phone!],
      source: 'walk_in'
    });
    contactId = contact.id;
  } catch (error) {
    if (error instanceof DuplicateContactError)
      return {
        error: 'A customer with this phone number already exists. Open them from Leads.',
        values
      };
    throw error;
  }
  const defs = new Set((await listFieldDefs(ctx, 'deal')).map((d) => d.key));
  const custom: Record<string, string | number> = {};
  if (defs.has('vehicle_year') && values.year) custom.vehicle_year = Number(values.year);
  if (defs.has('vehicle_make') && values.make) custom.vehicle_make = values.make;
  if (defs.has('vehicle_model') && values.model) custom.vehicle_model = values.model;
  const car = [values.year, values.make, values.model].filter(Boolean).join(' ');
  await createDeal(ctx, {
    title: car ? `Walk-in: ${car}` : `Walk-in: ${values.name}`,
    contactId,
    source: 'walk_in',
    custom
  });
  revalidatePath('/dashboard/shop/leads');
  redirect(`/dashboard/shop/leads/${contactId}`);
}
