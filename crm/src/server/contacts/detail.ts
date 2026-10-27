import { and, desc, eq, isNull } from 'drizzle-orm';
import { companies, consents, contacts, users } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { CONSENT_CHANNELS, type ConsentChannel } from '../consent';
import { NotFoundError, type Contact, type ContactOpts } from './service';
import { withTenant } from '../tenancy';

// Contact detail read model (M1-03; PRD F-06). One tenant-scoped read for the page header, the
// details card and the consent card. Timeline, tasks, notes and deals fill in as M3 and M2 ship.

const SELF_OPT_OUT_SOURCES = ['sms_keyword', 'call', 'email_link'];

export type ConsentStatus =
  | { channel: ConsentChannel; state: 'none' }
  | {
      channel: ConsentChannel;
      state: 'consented' | 'revoked' | 'opted_out' | 'dnc';
      source: string;
      capturedAt: string;
      revokedAt: string | null;
    };

export type ContactDetail = {
  contact: Contact;
  company: { id: string; name: string } | null;
  owner: { id: string; name: string | null; email: string } | null;
  /** One entry per channel, always present: "No consent recorded" is a state, not a gap. */
  consent: ConsentStatus[];
};

/** Mirrors canContact's reading of `consents`: newest event wins, most restrictive on a tie. */
export function currentConsent(
  channel: ConsentChannel,
  rows: { kind: string; source: string; capturedAt: string; revokedAt: string | null }[]
): ConsentStatus {
  const newest = rows.filter((r) => r.capturedAt === rows[0]?.capturedAt);
  const row =
    newest.find((r) => r.kind === 'dnc') ?? newest.find((r) => r.kind === 'opt_out') ?? newest[0];
  if (!row) return { channel, state: 'none' };
  const base = {
    channel,
    source: row.source,
    capturedAt: row.capturedAt,
    revokedAt: row.revokedAt
  };
  if (row.kind === 'dnc') return { ...base, state: 'dnc' };
  if (row.kind === 'opt_out') {
    return { ...base, state: SELF_OPT_OUT_SOURCES.includes(row.source) ? 'opted_out' : 'revoked' };
  }
  return { ...base, state: row.revokedAt ? 'revoked' : 'consented' };
}

/**
 * Everything the contact page shows. Another tenant's id (hidden by RLS), a soft-deleted contact
 * and a merged-away contact all throw NotFoundError, so the page can return the standard 404
 * without revealing that the id exists.
 */
export async function getContactDetail(
  ctx: TenantContextInput,
  id: string,
  opts: ContactOpts = {}
): Promise<ContactDetail> {
  parseInput(uuidSchema, id);
  const read = async (tx: Parameters<Parameters<typeof withTenant>[1]>[0]) => {
    const [contact] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, id), isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)))
      .limit(1);
    if (!contact) throw new NotFoundError();

    const [company] = contact.companyId
      ? await tx
          .select({ id: companies.id, name: companies.name })
          .from(companies)
          .where(eq(companies.id, contact.companyId))
          .limit(1)
      : [];
    const [owner] = contact.ownerId
      ? await tx
          .select({ id: users.id, name: users.name, email: users.email })
          .from(users)
          .where(eq(users.id, contact.ownerId))
          .limit(1)
      : [];

    const consent: ConsentStatus[] = [];
    for (const channel of CONSENT_CHANNELS) {
      const rows = await tx
        .select({
          kind: consents.kind,
          source: consents.source,
          capturedAt: consents.capturedAt,
          revokedAt: consents.revokedAt
        })
        .from(consents)
        .where(and(eq(consents.contactId, id), eq(consents.channel, channel)))
        .orderBy(desc(consents.capturedAt))
        .limit(20);
      consent.push(currentConsent(channel, rows));
    }
    return { contact, company: company ?? null, owner: owner ?? null, consent };
  };
  return opts.tx ? read(opts.tx) : withTenant(ctx, read, { db: opts.db });
}
