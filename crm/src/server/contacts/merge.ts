import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { recordActivity } from '../activity';
import { audit } from '../audit';
import type { Tx } from '../db/client';
import {
  activities,
  appointments,
  automationRuns,
  calls,
  consents,
  contacts,
  dealContacts,
  dncEntries,
  messages,
  notes,
  tasks
} from '../db/schema';
import { ValidationError } from '../errors';
import { emitEvent } from '../events';
import type { TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { NotFoundError, type Contact, type ContactOpts } from './service';
import { z } from 'zod';
import { withTenant } from '../tenancy';
import { uniqueTags } from './schemas';

// Merge duplicate contacts (M1-08, PRD F-07, DC-112). One transaction: lock both rows, fold the
// loser's phones, emails, tags and empty fields into the survivor, repoint every child record, carry
// opt-outs, then soft-remove the loser (`merged_into_id` + `deleted_at`). Consent rows are append-only
// evidence, so they stay on the loser and only opt-outs are copied forward.

const mergeInput = z.object({ survivorId: uuidSchema, loserId: uuidSchema });
export type MergeContactsInput = z.input<typeof mergeInput>;

const CONSENT_CHANNELS = ['phone_call', 'sms', 'email'] as const;

/** Child tables that carry a plain `contact_id` and are repointed with one UPDATE. */
const REPOINTED = [
  ['activities', activities],
  ['tasks', tasks],
  ['notes', notes],
  ['calls', calls],
  ['messages', messages],
  ['appointments', appointments],
  ['automationRuns', automationRuns],
  ['dncEntries', dncEntries]
] as const;

export type MergeCounts = Record<(typeof REPOINTED)[number][0] | 'deals', number>;

export type MergeResult = {
  survivor: Contact;
  loserId: string;
  moved: MergeCounts;
  carriedOptOuts: (typeof CONSENT_CHANNELS)[number][];
};

/** Both rows locked in id order (two merges of the same pair in opposite directions cannot deadlock). */
async function lockPair(tx: Tx, survivorId: string, loserId: string) {
  const rows = await tx
    .select()
    .from(contacts)
    .where(inArray(contacts.id, [survivorId, loserId]))
    .orderBy(asc(contacts.id))
    .for('update');
  const survivor = rows.find((r) => r.id === survivorId);
  const loser = rows.find((r) => r.id === loserId);
  const live = (r?: Contact) => !!r && !r.deletedAt && !r.mergedIntoId;
  if (!live(survivor) || !live(loser)) throw new NotFoundError();
  return { survivor: survivor as Contact, loser: loser as Contact };
}

const union = (a: readonly string[], b: readonly string[]) => [...new Set([...a, ...b])];
const isEmptyObject = (o: unknown) =>
  !o || (typeof o === 'object' && Object.keys(o as object).length === 0);

/** What the survivor keeps: its own values win; the loser only fills blanks and adds list entries. */
function foldFields(s: Contact, l: Contact): Partial<typeof contacts.$inferInsert> {
  const phones = union(s.phones, l.phones);
  const emails = union(s.emails, l.emails);
  return {
    phones,
    emails,
    primaryPhoneE164: s.primaryPhoneE164 ?? phones[0] ?? null,
    primaryEmail: s.primaryEmail ?? emails[0] ?? null,
    tags: uniqueTags([...s.tags, ...l.tags]),
    lastName: s.lastName || l.lastName || null,
    companyId: s.companyId ?? l.companyId,
    timezone: s.timezone ?? l.timezone,
    source: s.source ?? l.source,
    ownerId: s.ownerId ?? l.ownerId,
    address: isEmptyObject(s.address) ? l.address : s.address,
    custom: { ...(l.custom as object), ...(s.custom as object) },
    // The most restrictive state wins: a loser on the do-not-call list keeps the survivor blocked.
    doNotCallAt: s.doNotCallAt ?? l.doNotCallAt
  };
}

/** Deals: links the survivor already has are dropped, the rest move. Returns the number moved. */
async function moveDealLinks(tx: Tx, survivorId: string, loserId: string): Promise<number> {
  const keep = await tx
    .select({ dealId: dealContacts.dealId })
    .from(dealContacts)
    .where(eq(dealContacts.contactId, survivorId));
  if (keep.length) {
    await tx.delete(dealContacts).where(
      and(
        eq(dealContacts.contactId, loserId),
        inArray(
          dealContacts.dealId,
          keep.map((k) => k.dealId)
        )
      )
    );
  }
  const moved = await tx
    .update(dealContacts)
    .set({ contactId: survivorId })
    .where(eq(dealContacts.contactId, loserId))
    .returning({ dealId: dealContacts.dealId });
  return moved.length;
}

/**
 * Consent is append-only (DATABASE: no UPDATE grant), so the loser's rows stay as evidence. A grant
 * is not carried over (the survivor must show its own consent); an opt-out or DNC is, so merging
 * never makes anyone contactable who was not. Returns the channels that got a new opt-out row.
 */
async function carryOptOuts(tx: Tx, survivorId: string, loserId: string) {
  const carried: (typeof CONSENT_CHANNELS)[number][] = [];
  for (const channel of CONSENT_CHANNELS) {
    const [l] = await tx
      .select()
      .from(consents)
      .where(and(eq(consents.contactId, loserId), eq(consents.channel, channel)))
      .orderBy(desc(consents.capturedAt), desc(consents.createdAt))
      .limit(1);
    if (!l || (l.kind !== 'opt_out' && l.kind !== 'dnc')) continue;
    const [s] = await tx
      .select()
      .from(consents)
      .where(and(eq(consents.contactId, survivorId), eq(consents.channel, channel)))
      .orderBy(desc(consents.capturedAt), desc(consents.createdAt))
      .limit(1);
    if (s && (s.kind === 'opt_out' || s.kind === 'dnc') && s.capturedAt >= l.capturedAt) continue;
    await tx.insert(consents).values({
      tenantId: l.tenantId,
      contactId: survivorId,
      channel,
      kind: l.kind,
      source: 'merge',
      capturedText: `Carried over from merged contact ${loserId}`,
      capturedAt: sql`now()` as unknown as string
    });
    carried.push(channel);
  }
  return carried;
}

/** Counts of what a merge would move, for the confirmation step. Read-only. */
export async function previewMerge(
  ctx: TenantContextInput,
  input: MergeContactsInput,
  opts: ContactOpts = {}
): Promise<{ survivor: Contact; loser: Contact; counts: MergeCounts }> {
  const v = parseInput(mergeInput, input);
  const body = async (tx: Tx) => {
    const { survivor, loser } = await lockPairShared(tx, v.survivorId, v.loserId);
    const counts = {} as MergeCounts;
    for (const [key, table] of REPOINTED) {
      const [r] = await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(table)
        .where(eq(table.contactId, loser.id));
      counts[key] = r.n;
    }
    const [d] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(dealContacts)
      .where(eq(dealContacts.contactId, loser.id));
    counts.deals = d.n;
    return { survivor, loser, counts };
  };
  return opts.tx ? body(opts.tx) : withTenant(ctx, body, { db: opts.db });
}

async function lockPairShared(tx: Tx, survivorId: string, loserId: string) {
  const rows = await tx
    .select()
    .from(contacts)
    .where(
      and(
        inArray(contacts.id, [survivorId, loserId]),
        isNull(contacts.deletedAt),
        isNull(contacts.mergedIntoId)
      )
    );
  const survivor = rows.find((r) => r.id === survivorId);
  const loser = rows.find((r) => r.id === loserId);
  if (!survivor || !loser) throw new NotFoundError();
  return { survivor, loser };
}

export async function mergeContacts(
  ctx: TenantContextInput,
  input: MergeContactsInput,
  opts: ContactOpts = {}
): Promise<MergeResult> {
  const v = parseInput(mergeInput, input);
  if (v.survivorId === v.loserId) throw new ValidationError({ loserId: ['same_contact'] });

  const body = async (tx: Tx): Promise<MergeResult> => {
    const { survivor, loser } = await lockPair(tx, v.survivorId, v.loserId);

    const moved = {} as MergeCounts;
    for (const [key, table] of REPOINTED) {
      const rows = await tx
        .update(table)
        .set({ contactId: survivor.id })
        .where(eq(table.contactId, loser.id))
        .returning({ id: table.id });
      moved[key] = rows.length;
    }
    moved.deals = await moveDealLinks(tx, survivor.id, loser.id);
    const carriedOptOuts = await carryOptOuts(tx, survivor.id, loser.id);

    const [after] = await tx
      .update(contacts)
      .set({
        ...foldFields(survivor, loser),
        updatedAt: sql`now()` as unknown as string
      })
      .where(eq(contacts.id, survivor.id))
      .returning();
    await tx
      .update(contacts)
      .set({
        mergedIntoId: survivor.id,
        deletedAt: sql`now()` as unknown as string,
        updatedAt: sql`now()` as unknown as string
      })
      .where(eq(contacts.id, loser.id));

    await recordActivity(tx, {
      contactId: survivor.id,
      type: 'system',
      refTable: 'contacts',
      refId: loser.id,
      summary: 'Merged a duplicate contact into this one',
      actor: { type: 'user', id: ctx.userId },
      meta: { survivorId: survivor.id, loserId: loser.id, moved }
    });
    await audit(tx, {
      action: 'contact.merge',
      entity: 'contact',
      entityId: survivor.id,
      before: { loserId: loser.id },
      after: { survivorId: survivor.id, moved, carriedOptOuts }
    });
    await emitEvent(tx, {
      name: 'contact.merged',
      tenantId: after.tenantId,
      actor: { type: 'user', id: ctx.userId },
      payload: { survivorId: survivor.id, loserId: loser.id }
    });
    return { survivor: after, loserId: loser.id, moved, carriedOptOuts };
  };
  return opts.tx ? body(opts.tx) : withTenant(ctx, body, { db: opts.db });
}
