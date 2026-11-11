import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { recordActivity } from '../activity';
import { audit } from '../audit';
import { canContact } from '../consent';
import type { Db, Tx } from '../db/client';
import { contacts, demoSeedRecords, reviewRequests, reviewSnapshots } from '../db/schema';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { calendarDateInTimeZone } from '../metrics';
import { addCalendarDays } from '../metrics/formulas';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';

/**
 * Reviews page data (SPEC 01). OPM surface: `review_snapshots` holds the monthly rating and count per
 * source, and `review_requests` records requests the client asked us to send. Nothing here sends a
 * message; a request is a queued row until live messaging is approved (P-A3).
 */

export const REVIEW_TREND_RANGES = ['90d', '12m'] as const;
export type ReviewTrendRange = (typeof REVIEW_TREND_RANGES)[number];

export type ReviewSnapshotRow = {
  id: string;
  source: string;
  capturedOn: string;
  reviewCount: number;
  averageRating: number | null;
  /** True when the reversible demo seed created the row. Only the owner can see the ledger. */
  demo: boolean;
};

export type ReviewRequestRow = {
  id: string;
  contactId: string;
  contactName: string;
  channel: 'sms' | 'email';
  status: string;
  requestedAt: string;
};

export type ReviewsData = {
  rating: number | null;
  totalReviews: number;
  newThisMonth: number;
  requestsTotal: number;
  trend: { month: string; values: Record<string, number | null> }[];
  sources: string[];
  snapshots: ReviewSnapshotRow[];
  requests: ReviewRequestRow[];
  /** Live contacts the request form can pick, newest first. */
  contactOptions: { id: string; name: string; phone: string | null; email: string | null }[];
};

export type ReviewOpts = { db?: Db; tx?: Tx; now?: Date };

function run<T>(ctx: TenantContextInput, opts: ReviewOpts, fn: (tx: Tx) => Promise<T>) {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

const firstName = (row: { firstName: string; lastName: string | null }) =>
  [row.firstName, row.lastName].filter(Boolean).join(' ') || 'Unnamed contact';

export function reviewTrendStart(
  range: ReviewTrendRange,
  today: string,
  monthStart: string
): string {
  if (range === '12m') {
    const d = new Date(`${monthStart}T00:00:00.000Z`);
    d.setUTCMonth(d.getUTCMonth() - 11);
    return d.toISOString().slice(0, 10);
  }
  return addCalendarDays(today, -89);
}

export function resolveReviewTrendRange(raw: string | undefined): ReviewTrendRange {
  return raw === '12m' ? '12m' : '90d';
}

type LatestSnapshot = {
  source: string;
  capturedOn: string;
  reviewCount: number;
  averageRating: number | null;
};

async function latestSnapshots(tx: Tx): Promise<LatestSnapshot[]> {
  const rows = await tx.execute<{
    source: string;
    captured_on: string;
    review_count: number;
    average_rating: string | null;
  }>(sql`
    select distinct on (source) source, captured_on, review_count, average_rating
    from review_snapshots
    where tenant_id = app_tenant_id()
    order by source, captured_on desc, created_at desc
  `);
  return Array.from(rows).map((r) => ({
    source: r.source,
    capturedOn: String(r.captured_on).slice(0, 10),
    reviewCount: Number(r.review_count),
    averageRating: r.average_rating == null ? null : Number(r.average_rating)
  }));
}

/** Weighted by review count: a 300-review 4.8 counts more than a 3-review 3.0. */
export function weightedRating(rows: readonly LatestSnapshot[]): number | null {
  let weight = 0;
  let total = 0;
  for (const row of rows) {
    if (row.averageRating == null || row.reviewCount <= 0) continue;
    weight += row.reviewCount;
    total += row.averageRating * row.reviewCount;
  }
  if (weight === 0) return null;
  return Math.round((total / weight) * 10) / 10;
}

export async function reviewSummary(
  ctx: TenantContextInput,
  opts: ReviewOpts & { range?: ReviewTrendRange } = {}
): Promise<ReviewsData> {
  const now = opts.now ?? new Date();
  const range = opts.range ?? '90d';
  const read = async (tx: Tx): Promise<ReviewsData> => {
    await requireModule(ctx, 'opm', { tx });
    const [tenant] = await tx.execute<{ timezone: string }>(
      sql`select timezone from tenants where id = app_tenant_id()`
    );
    const today = calendarDateInTimeZone(now, tenant?.timezone ?? 'UTC');
    const monthStart = `${today.slice(0, 7)}-01`;
    const trendStart = reviewTrendStart(range, today, monthStart);

    const latest = await latestSnapshots(tx);
    const addedRows = await tx.execute<{ added: number }>(sql`
      with latest as (
        select distinct on (source) source, review_count, captured_on
        from review_snapshots
        where tenant_id = app_tenant_id()
        order by source, captured_on desc, created_at desc
      ), prior as (
        select distinct on (source) source, review_count
        from review_snapshots
        where tenant_id = app_tenant_id() and captured_on < ${monthStart}::date
        order by source, captured_on desc, created_at desc
      )
      select coalesce(sum(greatest(l.review_count - coalesce(p.review_count, 0), 0)), 0)::int as added
      from latest l left join prior p using (source)
      where l.captured_on >= ${monthStart}::date
    `);
    const trendRows = await tx.execute<{ month: string; source: string; rating: number }>(sql`
      select to_char(captured_on, 'YYYY-MM') as month,
             source,
             round(avg(average_rating)::numeric, 2)::float8 as rating
      from review_snapshots
      where tenant_id = app_tenant_id()
        and captured_on >= ${trendStart}::date
        and average_rating is not null
      group by 1, 2
      order by 1, 2
    `);
    const snapshotRows = await tx
      .select()
      .from(reviewSnapshots)
      .orderBy(desc(reviewSnapshots.capturedOn), desc(reviewSnapshots.createdAt))
      .limit(50);
    const requestRows = await tx
      .select({
        id: reviewRequests.id,
        contactId: reviewRequests.contactId,
        channel: reviewRequests.channel,
        status: reviewRequests.status,
        requestedAt: reviewRequests.requestedAt,
        firstName: contacts.firstName,
        lastName: contacts.lastName
      })
      .from(reviewRequests)
      .innerJoin(contacts, eq(contacts.id, reviewRequests.contactId))
      .orderBy(desc(reviewRequests.requestedAt))
      .limit(20);
    const [requestCount] = await tx.select({ n: sql<number>`count(*)::int` }).from(reviewRequests);
    const contactRows = await tx
      .select({
        id: contacts.id,
        firstName: contacts.firstName,
        lastName: contacts.lastName,
        phone: contacts.primaryPhoneE164,
        email: contacts.primaryEmail
      })
      .from(contacts)
      .where(and(isNull(contacts.deletedAt), isNull(contacts.mergedIntoId)))
      .orderBy(desc(contacts.createdAt))
      .limit(100);

    const demoIds = new Set<string>();
    if (snapshotRows.length) {
      try {
        const ledger = await tx
          .select({ recordId: demoSeedRecords.recordId })
          .from(demoSeedRecords)
          .where(
            and(
              eq(demoSeedRecords.tableName, 'review_snapshots'),
              inArray(
                demoSeedRecords.recordId,
                snapshotRows.map((r) => r.id)
              )
            )
          );
        for (const row of ledger) demoIds.add(row.recordId);
      } catch {
        // A staff role cannot read the owner-only demo ledger; rows simply show without the badge.
      }
    }

    const sources = new Set<string>();
    const months = new Map<string, Record<string, number | null>>();
    for (const row of Array.from(trendRows)) {
      sources.add(row.source);
      const values = months.get(row.month) ?? {};
      values[row.source] = Number(row.rating);
      months.set(row.month, values);
    }
    for (const row of latest) sources.add(row.source);

    return {
      rating: weightedRating(latest),
      totalReviews: latest.reduce((sum, r) => sum + r.reviewCount, 0),
      newThisMonth: Number(Array.from(addedRows)[0]?.added ?? 0),
      requestsTotal: Number(requestCount?.n ?? 0),
      trend: [...months.entries()]
        .toSorted(([a], [b]) => a.localeCompare(b))
        .map(([month, values]) => ({ month, values })),
      sources: [...sources].toSorted((a, b) => a.localeCompare(b)),
      snapshots: snapshotRows.map((r) => ({
        id: r.id,
        source: r.source,
        capturedOn: r.capturedOn,
        reviewCount: r.reviewCount,
        averageRating: r.averageRating == null ? null : Number(r.averageRating),
        demo: demoIds.has(r.id)
      })),
      requests: requestRows.map((r) => ({
        id: r.id,
        contactId: r.contactId,
        contactName: firstName(r),
        channel: r.channel === 'email' ? 'email' : 'sms',
        status: r.status,
        requestedAt: r.requestedAt
      })),
      contactOptions: contactRows.map((r) => ({
        id: r.id,
        name: firstName(r),
        phone: r.phone,
        email: r.email
      }))
    };
  };
  return run(ctx, opts, read);
}

export const requestReviewSchema = z.strictObject({
  contactId: uuidSchema,
  channel: z.enum(['sms', 'email'])
});
export type RequestReviewInput = z.input<typeof requestReviewSchema>;

/** Queues a review request. Blocked when canContact says no; no adapter is called. */
export async function requestReview(
  ctx: TenantContextInput,
  input: RequestReviewInput,
  opts: ReviewOpts = {}
): Promise<{ id: string; status: 'queued' }> {
  const value = parseInput(requestReviewSchema, input);
  if (ctx.readOnly) throw new AppError('FORBIDDEN');
  const now = opts.now ?? new Date();
  const write = async (tx: Tx) => {
    await requireModule(ctx, 'opm', { tx });
    const [contact] = await tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.id, value.contactId),
          isNull(contacts.deletedAt),
          isNull(contacts.mergedIntoId)
        )
      )
      .limit(1);
    if (!contact) throw new AppError('NOT_FOUND');
    const decision = await canContact(ctx, value.contactId, value.channel, now, { tx });
    if (!decision.allowed) {
      throw new AppError('CONFLICT', {
        message: `This contact cannot be contacted by ${value.channel} right now (${decision.reason}).`
      });
    }
    const [row] = await tx
      .insert(reviewRequests)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        contactId: value.contactId,
        channel: value.channel,
        status: 'queued',
        requestedAt: now.toISOString(),
        createdBy: ctx.userId ?? null
      })
      .returning({ id: reviewRequests.id });
    await audit(tx, {
      action: 'review.request',
      entity: 'review_request',
      entityId: row.id,
      after: { contactId: value.contactId, channel: value.channel, status: 'queued' }
    });
    await recordActivity(tx, {
      contactId: value.contactId,
      type: 'system',
      refTable: 'review_request',
      refId: row.id,
      summary: `Review request queued (${value.channel})`,
      actor: { type: 'user', id: ctx.userId ?? null },
      occurredAt: now
    });
    return { id: row.id, status: 'queued' as const };
  };
  return run(ctx, opts, write);
}
