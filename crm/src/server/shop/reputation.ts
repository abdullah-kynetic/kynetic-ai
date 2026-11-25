import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { audit } from '../audit';
import { contacts, presenceItems, reviewRequests, reviewSnapshots } from '../db/schema';
import { AppError } from '../errors';
import { weightedRating } from '../reviews';
import type { TenantContextInput } from '../tenancy';
import { AWAY_ITEM_TITLE } from './away';
import { shopRun, type ShopOpts } from './guard';

/**
 * Drafted review replies live in `presence_items`, whose `kind` is limited by a database check to
 * profile, review_site, directory and social_post. A reply is a `review_site` row whose notes are a
 * JSON object with `type: 'review_reply'`; plain listings never have JSON notes.
 */
export const REVIEW_REPLY_KIND = 'review_site';
const REPLY_TYPE = 'review_reply';

export type ReviewSource = {
  source: string;
  reviewCount: number;
  averageRating: number | null;
  capturedOn: string;
};

export type ReviewReply = {
  id: string;
  reviewer: string;
  rating: number;
  source: string;
  text: string;
  reply: string;
  approved: boolean;
  /** True for rows the sample-data loader wrote. */
  sample: boolean;
};

export type ReviewRequestItem = {
  id: string;
  customerName: string;
  channel: string;
  status: string;
  requestedAt: string;
  completedAt: string | null;
};

export type ReviewsView = {
  rating: number | null;
  totalReviews: number;
  sources: ReviewSource[];
  replies: ReviewReply[];
  requests: ReviewRequestItem[];
};

export type GetFoundView = {
  listings: { id: string; title: string; kind: string; status: string; notes: string }[];
  posts: { id: string; title: string; text: string; status: string }[];
};

function parseReply(row: { id: string; status: string; notes: string }): ReviewReply | null {
  try {
    const n = JSON.parse(row.notes) as Record<string, unknown>;
    if (n.type !== REPLY_TYPE) return null;
    if (typeof n.reviewer !== 'string' || typeof n.text !== 'string' || typeof n.reply !== 'string')
      return null;
    return {
      id: row.id,
      reviewer: n.reviewer,
      rating: typeof n.rating === 'number' ? n.rating : 0,
      source: typeof n.source === 'string' ? n.source : 'Google',
      text: n.text,
      reply: n.reply,
      approved: row.status === 'done',
      sample: n.sample === true
    };
  } catch {
    return null;
  }
}

/**
 * Reviews: the latest rating per source, recent reviews with a drafted reply each, and the review
 * requests. Individual reviews and their drafts are `presence_items` of kind `review_reply` (no new
 * table); until Google is connected only sample rows or rows entered by Kynetic exist.
 */
export async function getReviews(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<ReviewsView> {
  return shopRun(ctx, opts, async (tx) => {
    const snaps = await tx
      .select()
      .from(reviewSnapshots)
      .orderBy(desc(reviewSnapshots.capturedOn), desc(reviewSnapshots.createdAt));
    const latest = new Map<string, ReviewSource>();
    for (const s of snaps)
      if (!latest.has(s.source))
        latest.set(s.source, {
          source: s.source,
          reviewCount: s.reviewCount,
          averageRating: s.averageRating == null ? null : Number(s.averageRating),
          capturedOn: s.capturedOn
        });
    const sources = [...latest.values()].sort((a, b) => b.reviewCount - a.reviewCount);
    const items = await tx
      .select()
      .from(presenceItems)
      .where(eq(presenceItems.kind, REVIEW_REPLY_KIND))
      .orderBy(desc(presenceItems.createdAt));
    const replies = items.flatMap((r) => {
      const p = parseReply(r);
      return p ? [p] : [];
    });
    const requests = await tx
      .select({
        id: reviewRequests.id,
        first: contacts.firstName,
        last: contacts.lastName,
        channel: reviewRequests.channel,
        status: reviewRequests.status,
        requestedAt: reviewRequests.requestedAt,
        completedAt: reviewRequests.completedAt
      })
      .from(reviewRequests)
      .innerJoin(contacts, eq(contacts.id, reviewRequests.contactId))
      .orderBy(desc(reviewRequests.requestedAt))
      .limit(100);
    return {
      rating: weightedRating(sources),
      totalReviews: sources.reduce((n, s) => n + s.reviewCount, 0),
      sources,
      replies,
      requests: requests.map((r) => ({
        id: r.id,
        customerName: `${r.first} ${r.last ?? ''}`.trim(),
        channel: r.channel,
        status: r.status,
        requestedAt: r.requestedAt,
        completedAt: r.completedAt
      }))
    };
  });
}

/**
 * Marks a drafted reply approved in the portal. It records the approval and who gave it, and that is
 * all: no review site, text or email is contacted.
 */
export async function approveReviewReply(
  ctx: TenantContextInput,
  id: string,
  opts: ShopOpts = {}
): Promise<{ id: string; approved: true }> {
  if (ctx.readOnly || !ctx.userId) throw new AppError('FORBIDDEN');
  return shopRun(ctx, opts, async (tx) => {
    const [row] = await tx
      .select()
      .from(presenceItems)
      .where(and(eq(presenceItems.id, id), eq(presenceItems.kind, REVIEW_REPLY_KIND)))
      .limit(1);
    if (!row || !parseReply(row)) throw new AppError('NOT_FOUND');
    if (row.status !== 'done') {
      const notes = {
        ...(JSON.parse(row.notes) as Record<string, unknown>),
        approvedAt: new Date().toISOString(),
        approvedBy: ctx.userId
      };
      await tx
        .update(presenceItems)
        .set({ status: 'done', notes: JSON.stringify(notes), updatedAt: sql`now()` })
        .where(eq(presenceItems.id, id));
      await audit(tx, {
        action: 'shop.review_reply.approve',
        entity: 'presence_item',
        entityId: id,
        before: { status: row.status },
        after: { status: 'done' }
      });
    }
    return { id, approved: true as const };
  });
}

/** Get found: the listings checklist and the post drafts, from the Online presence records. */
export async function getGetFound(
  ctx: TenantContextInput,
  opts: ShopOpts = {}
): Promise<GetFoundView> {
  return shopRun(ctx, opts, async (tx) => {
    const items = await tx
      .select()
      .from(presenceItems)
      .orderBy(asc(presenceItems.createdAt), asc(presenceItems.title));
    return {
      listings: items
        .filter((i) => ['profile', 'review_site', 'directory'].includes(i.kind))
        .filter((i) => !parseReply(i) && i.title !== AWAY_ITEM_TITLE)
        .map((i) => ({ id: i.id, title: i.title, kind: i.kind, status: i.status, notes: i.notes })),
      posts: items
        .filter((i) => i.kind === 'social_post')
        .map((i) => ({ id: i.id, title: i.title, text: i.notes, status: i.status }))
    };
  });
}
