import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { calls, contacts, dealContacts, messages } from '../db/schema';
import { AppError } from '../errors';
import type { TenantContextInput } from '../tenancy';
import { shopRun, type ShopOpts } from './guard';
import { loadJobCards } from './jobs';
import type { JobCard } from './types';

export const LEAD_SOURCES = [
  { key: 'ai_receptionist_call', label: 'AI receptionist call' },
  { key: 'missed_call_text', label: 'Missed-call text' },
  { key: 'website_photo_quote', label: 'Website photo quote' },
  { key: 'walk_in', label: 'Walk-in' },
  { key: 'google', label: 'Google' }
] as const;
export type LeadSourceKey = (typeof LEAD_SOURCES)[number]['key'] | 'other';

export const sourceLabel = (source: string | null): string =>
  LEAD_SOURCES.find((s) => s.key === source)?.label ??
  (source ? source.replaceAll('_', ' ') : 'Unknown');
export const sourceKey = (source: string | null): LeadSourceKey =>
  LEAD_SOURCES.find((s) => s.key === source)?.key ?? 'other';

export type LeadRow = {
  id: string;
  name: string;
  phone: string | null;
  source: string | null;
  sourceKey: LeadSourceKey;
  status: string;
  createdAt: string;
  stageName: string | null;
  vehicleLabel: string;
  dealTitle: string | null;
  summary: string | null;
};

export type LeadList = {
  rows: LeadRow[];
  /** Count per chip over every lead, so a chip never shows a count that its own filter changes. */
  counts: Record<LeadSourceKey, number> & { all: number };
};

const fullName = (first: string, last: string | null) =>
  `${first} ${last ?? ''}`.trim() || 'Unnamed lead';

/** Leads for the shop: contacts with their latest job, call summary and where they came from. */
export async function getShopLeads(
  ctx: TenantContextInput,
  opts: ShopOpts & { source?: LeadSourceKey } = {}
): Promise<LeadList> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const people = await tx
      .select({
        id: contacts.id,
        first: contacts.firstName,
        last: contacts.lastName,
        phone: contacts.primaryPhoneE164,
        source: contacts.source,
        status: contacts.status,
        createdAt: contacts.createdAt
      })
      .from(contacts)
      .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)))
      .orderBy(desc(contacts.createdAt))
      .limit(500);
    const counts = { all: people.length, other: 0 } as LeadList['counts'];
    for (const s of LEAD_SOURCES) counts[s.key] = 0;
    for (const p of people) counts[sourceKey(p.source)]++;
    const chosen = opts.source ? people.filter((p) => sourceKey(p.source) === opts.source) : people;
    if (chosen.length === 0) return { rows: [], counts };
    const ids = chosen.map((p) => p.id);
    const { cards } = await loadJobCards(tx, now);
    const links = await tx
      .select({
        contactId: dealContacts.contactId,
        dealId: dealContacts.dealId
      })
      .from(dealContacts)
      .where(inArray(dealContacts.contactId, ids));
    const jobByContact = new Map<string, JobCard>();
    for (const l of links) {
      const card = cards.find((c) => c.id === l.dealId);
      if (card && !jobByContact.has(l.contactId)) jobByContact.set(l.contactId, card);
    }
    const callRows = await tx
      .select({ contactId: calls.contactId, summary: calls.summary })
      .from(calls)
      .where(inArray(calls.contactId, ids))
      .orderBy(desc(calls.startedAt));
    const summaryByContact = new Map<string, string>();
    for (const c of callRows)
      if (c.contactId && c.summary && !summaryByContact.has(c.contactId))
        summaryByContact.set(c.contactId, c.summary);
    return {
      counts,
      rows: chosen.map((p) => {
        const job = jobByContact.get(p.id);
        return {
          id: p.id,
          name: fullName(p.first, p.last),
          phone: p.phone,
          source: p.source,
          sourceKey: sourceKey(p.source),
          status: p.status,
          createdAt: p.createdAt,
          stageName: job?.stageName ?? null,
          vehicleLabel: job?.vehicleLabel ?? '',
          dealTitle: job?.title ?? null,
          summary: summaryByContact.get(p.id) ?? null
        };
      })
    };
  });
}

export type ConversationItem = {
  id: string;
  kind: 'call' | 'text';
  direction: 'inbound' | 'outbound';
  at: string;
  text: string;
  detail: string | null;
};

export type LeadDetail = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  status: string;
  createdAt: string;
  summary: string | null;
  jobs: JobCard[];
  conversation: ConversationItem[];
  /** No photo storage yet, so this is always empty. The page says so. */
  photos: { id: string; url: string }[];
};

export async function getShopLeadDetail(
  ctx: TenantContextInput,
  contactId: string,
  opts: ShopOpts = {}
): Promise<LeadDetail> {
  const now = opts.now ?? new Date();
  return shopRun(ctx, opts, async (tx) => {
    const [p] = await tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
      .limit(1);
    if (!p) throw new AppError('NOT_FOUND');
    const { cards } = await loadJobCards(tx, now);
    const links = await tx
      .select({ dealId: dealContacts.dealId })
      .from(dealContacts)
      .where(eq(dealContacts.contactId, contactId));
    const jobs = cards.filter((c) => links.some((l) => l.dealId === c.id));
    const callRows = await tx
      .select()
      .from(calls)
      .where(eq(calls.contactId, contactId))
      .orderBy(asc(calls.startedAt));
    const textRows = await tx
      .select()
      .from(messages)
      .where(eq(messages.contactId, contactId))
      .orderBy(asc(messages.createdAt));
    const conversation: ConversationItem[] = [
      ...callRows.map((c) => ({
        id: c.id,
        kind: 'call' as const,
        direction: c.direction as 'inbound' | 'outbound',
        at: c.startedAt,
        text: c.summary ?? 'Call, no summary recorded.',
        detail: c.outcome ? c.outcome.replaceAll('_', ' ') : null
      })),
      ...textRows.map((m) => ({
        id: m.id,
        kind: 'text' as const,
        direction: m.direction as 'inbound' | 'outbound',
        at: m.createdAt,
        text: m.body,
        detail: m.status
      }))
    ].sort((a, b) => a.at.localeCompare(b.at));
    const lastSummary = [...callRows].reverse().find((c) => c.summary)?.summary ?? null;
    return {
      id: p.id,
      name: fullName(p.firstName, p.lastName),
      phone: p.primaryPhoneE164,
      email: p.primaryEmail,
      source: p.source,
      status: p.status,
      createdAt: p.createdAt,
      summary: lastSummary ?? jobs[0]?.title ?? null,
      jobs,
      conversation,
      photos: []
    };
  });
}
