'use server';

import {
  bulkUpdateContacts,
  contactsActorScope,
  contactsScope,
  loadContactForPanel,
  saveContactFromPanel,
  type BulkContactsResult,
  type PanelSaveResult
} from '@/server/contacts';
import { createContactSchema } from '@/server/contacts/schemas';
import { errorBody, toErrorResult, type ErrorBody } from '@/server/errors';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import type { LoadedPanelValues, PanelValues } from '@/features/contacts/panel/values';
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
  /** Typed custom field values (F-12); the service checks them against the tenant's definitions. */
  custom?: Record<string, unknown>;
  acknowledgeDuplicates?: boolean;
}): Promise<PanelSaveResult> {
  const ctx = await contactsScope(await headers(), 'tenant_data.write');
  if (!ctx) return FORBIDDEN;
  const result = await saveContactFromPanel(ctx, {
    id: input.id,
    values: toContactInput(input.values, input.custom),
    acknowledgeDuplicates: input.acknowledgeDuplicates === true
  });
  if (result.ok) revalidatePath('/dashboard/contacts');
  return result;
}

export async function loadContactAction(id: string): Promise<LoadedPanelValues | null> {
  const ctx = await contactsScope(await headers());
  if (!ctx) return null;
  const c = await loadContactForPanel(ctx, id);
  return c ? valuesFromContact(c) : null;
}

export type BulkActionResult = ({ ok: true } & BulkContactsResult) | ErrorBody;

/**
 * Bulk action on the leads list (F-08). The browser sends ids and one action; the tenant, the
 * actor and the CRM Full check all come from the server (the service re-checks each one), so a
 * hidden button is never the only guard.
 */
export async function bulkContactsAction(input: unknown): Promise<BulkActionResult> {
  try {
    const scope = await contactsActorScope(await headers());
    if (!scope) return errorBody('FORBIDDEN');
    const result = await bulkUpdateContacts(scope.ctx, scope.actor, input as never);
    revalidatePath('/dashboard/contacts');
    return { ok: true, ...result };
  } catch (err) {
    return toErrorResult(err).body;
  }
}
