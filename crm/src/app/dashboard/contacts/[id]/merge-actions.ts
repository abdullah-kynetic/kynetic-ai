'use server';

import { contactsScope, mergeContacts } from '@/server/contacts';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';

export type MergeResult = { ok: true } | { ok: false; message: string };

export async function mergeContactAction(
  survivorId: string,
  loserId: string
): Promise<MergeResult> {
  const ctx = await contactsScope(await headers(), 'tenant_data.write');
  if (!ctx) return { ok: false, message: 'You do not have access to merge contacts.' };
  try {
    await mergeContacts(ctx, survivorId, loserId);
    revalidatePath('/dashboard/contacts');
    revalidatePath(`/dashboard/contacts/${survivorId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not merge contacts.'
    };
  }
}
