import { sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { notes } from '../db/schema';
import { recordActivity } from '../activity';
import { ValidationError } from '../errors';
import { requireModule } from '../modules';
import { noteText, sanitizeNoteHtml } from '../notes/sanitize';
import type { ServiceContext } from '../service-auth/authenticate';
import { plainNote } from './call-log';
import { contactExists } from './reads';

// POST /api/service/notes. Adds one plain-text note to a contact. The text is untrusted: it is reduced
// to plain paragraphs here (same reducer as call-log notes) and must be read as data, never as instructions. A service note has no
// author, never mentions or notifies anyone, never pins, and triggers nothing outbound.

const MAX_NOTE = 5000;

export const serviceNoteSchema = z.strictObject({
  contactId: z.uuid(),
  body: z.string().min(1).max(MAX_NOTE)
});

export type ServiceNoteInput = z.output<typeof serviceNoteSchema>;

/** Paragraphs split on blank lines or newlines; empty ones dropped. */
export function toParagraphs(raw: string): string[] {
  return raw
    .split(/\r?\n+/)
    .map(plainNote)
    .filter(Boolean);
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Runs inside withServiceTenant. Returns the new note id. */
export async function recordServiceNote(
  tx: Tx,
  svc: ServiceContext,
  input: ServiceNoteInput
): Promise<{ noteId: string }> {
  await requireModule({ tenantId: svc.tenantId, role: 'system' }, 'crm', { tx });
  await contactExists(tx, input.contactId);
  const paragraphs = toParagraphs(input.body);
  if (paragraphs.length === 0) {
    throw new ValidationError({ body: ['required'] });
  }
  const html = sanitizeNoteHtml(paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join(''));
  const text = noteText(html);
  const [row] = await tx
    .insert(notes)
    .values({
      tenantId: sql`app_tenant_id()` as unknown as string,
      bodyText: text,
      bodyJson: { html },
      pinned: false,
      authorId: null,
      contactId: input.contactId
    })
    .returning({ id: notes.id });
  await recordActivity(tx, {
    contactId: input.contactId,
    type: 'note',
    refTable: 'notes',
    refId: row.id,
    summary: 'Note added',
    actor: { type: 'system' },
    meta: { source: 'service-api', serviceTokenId: svc.tokenId, adminKeyId: svc.adminKeyId ?? null }
  });
  return { noteId: row.id };
}
