import { and, eq, inArray } from 'drizzle-orm';
import { isIP } from 'node:net';
import { getDb, type Db, type Tx } from '../db/client';
import { termsAcceptances } from '../db/schema';
import { setSessionContext } from '../tenancy/set-context';
import { CURRENT_DOCUMENTS, type LegalDocument } from './documents';

export { CURRENT_DOCUMENTS, type LegalDocument, type TermsDocument } from './documents';

/**
 * `terms_acceptances` is global: a user reads and inserts only their own rows (RLS on app_user_id()),
 * and no tenant is involved, so this sets the user without a tenant.
 */
async function withUser<T>(
  userId: string,
  fn: (tx: Tx) => Promise<T>,
  db: Db = getDb()
): Promise<T> {
  return db.transaction(async (tx) => {
    await setSessionContext(tx, { userId, role: 'system', readOnly: false });
    return fn(tx);
  });
}

/** Documents (at their current version) the user has not accepted yet. Empty means carry on. */
export async function pendingDocuments(
  userId: string,
  opts: { db?: Db; documents?: readonly LegalDocument[] } = {}
): Promise<LegalDocument[]> {
  const documents = opts.documents ?? CURRENT_DOCUMENTS;
  const rows = await withUser(
    userId,
    (tx) =>
      tx
        .select({ document: termsAcceptances.document, version: termsAcceptances.version })
        .from(termsAcceptances)
        .where(
          and(
            eq(termsAcceptances.userId, userId),
            inArray(
              termsAcceptances.document,
              documents.map((d) => d.document)
            )
          )
        ),
    opts.db
  );
  const accepted = new Set(rows.map((r) => `${r.document}@${r.version}`));
  return documents.filter((d) => !accepted.has(`${d.document}@${d.version}`));
}

/** The first hop of x-forwarded-for if it is a real address, else null. Stored as `inet`. */
export function clientIp(forwardedFor: string | null): string | null {
  const first = forwardedFor?.split(',')[0]?.trim();
  return first && isIP(first) ? first : null;
}

/**
 * Records acceptance of every document still pending, with the version, the time (database default)
 * and the IP. Safe to call twice: a second call, or a double submit, adds nothing.
 */
export async function recordAcceptance(
  userId: string,
  ip: string | null,
  opts: { db?: Db; documents?: readonly LegalDocument[] } = {}
): Promise<void> {
  const documents = opts.documents ?? CURRENT_DOCUMENTS;
  await withUser(
    userId,
    (tx) =>
      tx
        .insert(termsAcceptances)
        .values(documents.map((d) => ({ userId, document: d.document, version: d.version, ip })))
        .onConflictDoNothing(),
    opts.db
  );
}
