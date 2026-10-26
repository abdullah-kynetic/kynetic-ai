'use server';

import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { bulkUpdateContacts, contactsActorScope, type BulkContactsResult } from '@/server/contacts';
import { errorBody, toErrorResult, type ErrorBody } from '@/server/errors';

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
