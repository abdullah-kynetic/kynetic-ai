import { AppError } from '../errors';
import type { FieldErrors } from '../errors';
import type { TenantContextInput } from '../tenancy';
import type { CreateContactInput } from './schemas';
import {
  createManualLead,
  DuplicateContactError,
  getContact,
  NotFoundError,
  updateContact,
  type Contact,
  type ContactOpts,
  type DuplicateMatch
} from './service';

// Save entry point for the create and edit panel (M1-04, PRD F-07). The panel never sees thrown
// errors: a duplicate comes back as data so it can show the match and offer "Open it" or "Create
// anyway", and field errors come back by field path. Creating through the panel is a manual lead.

export type PanelSaveResult =
  | { ok: true; id: string }
  | { ok: false; kind: 'duplicate'; matches: DuplicateMatch[] }
  | { ok: false; kind: 'invalid'; fieldErrors: FieldErrors }
  | { ok: false; kind: 'not_found' }
  | { ok: false; kind: 'error'; message: string };

export async function saveContactFromPanel(
  ctx: TenantContextInput,
  input: {
    id?: string;
    values: CreateContactInput;
    acknowledgeDuplicates?: boolean;
  },
  opts: ContactOpts = {}
): Promise<PanelSaveResult> {
  const o = { ...opts, acknowledgeDuplicates: input.acknowledgeDuplicates };
  try {
    const row: Contact = input.id
      ? await updateContact(ctx, input.id, input.values, o)
      : await createManualLead(ctx, input.values, o);
    return { ok: true, id: row.id };
  } catch (e) {
    if (e instanceof DuplicateContactError)
      return { ok: false, kind: 'duplicate', matches: e.matches };
    if (e instanceof NotFoundError) return { ok: false, kind: 'not_found' };
    if (e instanceof AppError && e.code === 'VALIDATION_FAILED' && e.fieldErrors) {
      return { ok: false, kind: 'invalid', fieldErrors: e.fieldErrors };
    }
    if (e instanceof AppError) return { ok: false, kind: 'error', message: e.message };
    throw e;
  }
}

/** The contact to edit, or null when it is gone or belongs to another tenant (RLS hides it). */
export async function loadContactForPanel(
  ctx: TenantContextInput,
  id: string,
  opts: ContactOpts = {}
): Promise<Contact | null> {
  try {
    return await getContact(ctx, id, opts);
  } catch (e) {
    if (e instanceof NotFoundError) return null;
    if (e instanceof AppError && e.code === 'VALIDATION_FAILED') return null;
    throw e;
  }
}
