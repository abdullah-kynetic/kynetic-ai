import { and, count, desc, eq, gte, isNull, lt, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { authorize, type Actor } from '../auth';
import type { Db } from '../db/client';
import { calls, contacts, tenants } from '../db/schema';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';
import { CALL_OUTCOMES, CALL_SENTIMENTS, type CallOutcome, type CallSentiment } from './outcomes';

// Calls list read model (M4-10; PRD F-26). Filters by outcome, direction and date, newest first.
// Reads ride calls_list_idx and calls_outcome_idx, so a 10,000-call tenant stays well under 500 ms.

/** The shared table footer offers these page sizes (DESIGN_SYSTEM data table). */
export const CALL_PAGE_SIZES = [10, 20, 30, 40, 50] as const;
export const CALL_DEFAULT_PAGE_SIZE = 20;

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const listCallsQuerySchema = z
  .object({
    outcome: z.enum(CALL_OUTCOMES).optional(),
    direction: z.enum(['inbound', 'outbound']).optional(),
    /** Inclusive local dates in the tenant's time zone. */
    from: day.optional(),
    to: day.optional(),
    page: z.coerce.number().int().min(1).max(100_000).default(1),
    pageSize: z.coerce
      .number()
      .int()
      .refine((n) => (CALL_PAGE_SIZES as readonly number[]).includes(n))
      .default(CALL_DEFAULT_PAGE_SIZE)
  })
  .strict();

export type ListCallsQuery = z.input<typeof listCallsQuerySchema>;

export type CallListRow = {
  id: string;
  startedAt: string;
  direction: 'inbound' | 'outbound';
  durationS: number | null;
  outcome: CallOutcome | null;
  sentiment: CallSentiment | null;
  flagged: boolean;
  /** Null when the call has no live contact (unmatched, deleted or merged away). */
  contact: { id: string; name: string } | null;
};

export type CallList = {
  rows: CallListRow[];
  total: number;
  page: number;
  pageSize: number;
  /** The tenant's time zone, so the page can show times the way the business reads them. */
  timeZone: string;
};

/**
 * One page of the tenant's calls. Needs `calls.read` and the `alex_core` module; a call that belongs
 * to another tenant never appears (RLS). Malformed filters throw ValidationError.
 */
export async function listCalls(
  actor: Actor,
  ctx: TenantContextInput,
  query: unknown = {},
  opts: { db?: Db } = {}
): Promise<CallList> {
  authorize(actor, 'calls.read', ctx.tenantId);
  const q = parseInput(listCallsQuerySchema, query);
  await requireModule(ctx, 'alex_core', opts);

  return withTenant(
    ctx,
    async (tx) => {
      const [tenant] = await tx
        .select({ timeZone: tenants.timezone })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      const timeZone = tenant?.timeZone ?? 'UTC';

      const where: SQL[] = [];
      if (q.outcome) where.push(eq(calls.outcome, q.outcome));
      if (q.direction) where.push(eq(calls.direction, q.direction));
      if (q.from)
        where.push(
          gte(calls.startedAt, sql`(${q.from}::date)::timestamp AT TIME ZONE ${timeZone}`)
        );
      if (q.to)
        where.push(
          lt(calls.startedAt, sql`((${q.to}::date + 1)::timestamp) AT TIME ZONE ${timeZone}`)
        );
      const filter = where.length ? and(...where) : undefined;

      const [{ total }] = await tx.select({ total: count() }).from(calls).where(filter);
      const rows = await tx
        .select({
          id: calls.id,
          startedAt: calls.startedAt,
          direction: calls.direction,
          durationS: calls.durationS,
          outcome: calls.outcome,
          sentiment: calls.sentiment,
          flagged: calls.flagged,
          contactId: contacts.id,
          firstName: contacts.firstName,
          lastName: contacts.lastName
        })
        .from(calls)
        .leftJoin(
          contacts,
          and(
            eq(contacts.id, calls.contactId),
            isNull(contacts.deletedAt),
            isNull(contacts.mergedIntoId)
          )
        )
        .where(filter)
        .orderBy(desc(calls.startedAt), desc(calls.id))
        .limit(q.pageSize)
        .offset((q.page - 1) * q.pageSize);

      return {
        total,
        page: q.page,
        pageSize: q.pageSize,
        timeZone,
        rows: rows.map((r) => ({
          id: r.id,
          startedAt: r.startedAt,
          direction: r.direction as CallListRow['direction'],
          durationS: r.durationS,
          outcome: r.outcome as CallOutcome | null,
          sentiment: (CALL_SENTIMENTS as readonly string[]).includes(r.sentiment ?? '')
            ? (r.sentiment as CallSentiment)
            : null,
          flagged: r.flagged,
          contact: r.contactId
            ? {
                id: r.contactId,
                name:
                  [r.firstName, r.lastName].filter((p) => p && p.trim()).join(' ') ||
                  'Unnamed contact'
              }
            : null
        }))
      };
    },
    opts
  );
}
