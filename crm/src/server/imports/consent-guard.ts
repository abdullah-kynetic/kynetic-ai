import { and, inArray, isNull } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { consents, dncEntries } from '../db/schema';

/**
 * An import may never save consent for someone who has opted out or is on the do-not-call list
 * (KI-036). A consent date in a file is the file's claim; the opt-out is the person's own word.
 * Anyone who has an opt-out or DNC row on any channel, a do-not-call date, or a phone on the
 * tenant's active DNC list is refused. Staff can still record fresh consent by hand.
 */
export async function suppressedContactIds(
  tx: Tx,
  contacts: { id: string; doNotCallAt?: string | null }[]
): Promise<Set<string>> {
  const blocked = new Set(contacts.filter((c) => c.doNotCallAt).map((c) => c.id));
  const ids = contacts.map((c) => c.id);
  if (!ids.length) return blocked;
  const rows = await tx
    .select({ contactId: consents.contactId })
    .from(consents)
    .where(and(inArray(consents.contactId, ids), inArray(consents.kind, ['opt_out', 'dnc'])));
  for (const row of rows) blocked.add(row.contactId);
  return blocked;
}

/** Phones on the tenant's active DNC list, for people who are not contacts yet. */
export async function dncPhones(tx: Tx, phones: string[]): Promise<Set<string>> {
  if (!phones.length) return new Set();
  const rows = await tx
    .select({ e164: dncEntries.e164 })
    .from(dncEntries)
    .where(and(inArray(dncEntries.e164, phones), isNull(dncEntries.removedAt)));
  return new Set(rows.map((r) => r.e164));
}

/** True when consent from a file must not be saved for this person. `contact` is null for a new row. */
export async function consentRefused(
  tx: Tx,
  contact: { id: string; doNotCallAt?: string | null; phones: string[] } | null,
  phones: string[]
): Promise<boolean> {
  if (contact && (await suppressedContactIds(tx, [contact])).has(contact.id)) return true;
  const listed = await dncPhones(tx, [...new Set([...(contact?.phones ?? []), ...phones])]);
  return listed.size > 0;
}
