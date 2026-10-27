'use server';

import {
  contactsScope,
  loadContactForPanel,
  saveContactFromPanel,
  type PanelSaveResult
} from '@/server/contacts';
import { createContactSchema } from '@/server/contacts/schemas';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { PanelValues } from '@/features/contacts/panel/values';
import { toContactInput, valuesFromContact } from '@/features/contacts/panel/values';

// Server actions behind the create and edit panel (M1-04). The tenant comes from the membership
// row, never from the client, and the actor needs `tenant_data.write` (a view-as read-only session
// and Kynetic staff outside view-as are refused). Origin checks are Next's own for server actions.

const FORBIDDEN: PanelSaveResult = {
  ok: false,
  kind: 'error',
  message: 'You do not have access to change contacts.'
};

export async function saveContactAction(input: {
  id?: string;
  values: PanelValues;
  acknowledgeDuplicates?: boolean;
}): Promise<PanelSaveResult> {
  const ctx = await contactsScope(await headers(), 'tenant_data.write');
  if (!ctx) return FORBIDDEN;
  const result = await saveContactFromPanel(ctx, {
    id: input.id,
    values: toContactInput(input.values),
    acknowledgeDuplicates: input.acknowledgeDuplicates === true
  });
  if (result.ok) revalidatePath('/dashboard/contacts');
  return result;
}

export async function loadContactAction(id: string): Promise<PanelValues | null> {
  const ctx = await contactsScope(await headers());
  if (!ctx) return null;
  const c = await loadContactForPanel(ctx, id);
  return c ? valuesFromContact(c) : null;
}
