'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { AppError } from '@/server/errors';
import { createAgencyProspect, moveProspectsToSales } from '@/server/agency/prospects';
import { agencyCaller } from '../agency/caller';

export async function moveProspectsToSalesAction(ids: string[]) {
  const caller = await agencyCaller();
  try {
    const result = await moveProspectsToSales(caller, ids);
    revalidatePath('/admin/prospecting', 'layout');
    revalidatePath('/admin/sales');
    return { ok: true, ...result } as const;
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message } as const;
    return { ok: false, message: 'Could not move these prospects. Try again.' } as const;
  }
}

export async function createProspectAction(form: FormData) {
  const caller = await agencyCaller();
  const field = (name: string) => String(form.get(name) ?? '');
  let failed = false;
  try {
    await createAgencyProspect(caller, {
      businessName: field('businessName'),
      source: field('source'),
      website: field('website'),
      phone: field('phone'),
      email: field('email'),
      ownerName: field('ownerName'),
      city: field('city'),
      state: field('state')
    });
  } catch (error) {
    if (!(error instanceof AppError)) throw error;
    failed = true;
  }
  revalidatePath('/admin/prospecting', 'layout');
  redirect(failed ? '/admin/prospecting/scraped?error=invalid' : '/admin/prospecting/scraped');
}
