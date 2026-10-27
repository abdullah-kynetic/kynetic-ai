import { and, asc, eq, inArray, isNull, lt, sql } from 'drizzle-orm';
import { contacts, dealContacts, deals, memberships, tasks, users } from '../db/schema';
import type { TenantContextInput } from '../tenancy';
import { getBoard, run, type Board, type DealOpts } from './pipelines';
import type { BoardFilters } from './schemas';

// What the kanban page renders (M2-02; PRD F-16): the board from `getBoard` plus the contact name on
// each card, which deals have an overdue open task, and the filter options (owners and sources).

export type BoardView = Board & {
  /** deal id to the name of its primary (first linked) contact; absent when no contact is linked. */
  contactNames: Record<string, string>;
  /** Deals that have an open task past its due time. */
  overdueDealIds: string[];
  filters: {
    owners: { id: string; name: string }[];
    sources: string[];
  };
};

export async function getBoardView(
  ctx: TenantContextInput,
  filters: BoardFilters = {},
  opts: DealOpts = {}
): Promise<BoardView> {
  const board = await getBoard(ctx, filters, opts);
  const dealIds = board.columns.flatMap((c) => c.deals.map((d) => d.id));
  return run(ctx, opts, async (tx) => {
    const contactNames: Record<string, string> = {};
    const overdue: string[] = [];
    if (dealIds.length > 0) {
      const links = await tx
        .select({
          dealId: dealContacts.dealId,
          first: contacts.firstName,
          last: contacts.lastName
        })
        .from(dealContacts)
        .innerJoin(contacts, eq(contacts.id, dealContacts.contactId))
        .where(and(inArray(dealContacts.dealId, dealIds), isNull(contacts.deletedAt)))
        .orderBy(asc(dealContacts.createdAt));
      for (const l of links) {
        if (l.dealId in contactNames) continue;
        const name = `${l.first} ${l.last ?? ''}`.trim();
        if (name) contactNames[l.dealId] = name;
      }
      const late = await tx
        .selectDistinct({ dealId: tasks.dealId })
        .from(tasks)
        .where(
          and(
            inArray(tasks.dealId, dealIds),
            isNull(tasks.completedAt),
            isNull(tasks.deletedAt),
            lt(tasks.dueAt, sql`now()`)
          )
        );
      for (const t of late) if (t.dealId) overdue.push(t.dealId);
    }
    const owners = await tx
      .select({ id: users.id, name: sql<string>`coalesce(${users.name}, ${users.email})` })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(sql`${memberships.tenantId} = app_tenant_id()`)
      .orderBy(sql`lower(coalesce(${users.name}, ${users.email}))`);
    const sources = await tx
      .selectDistinct({ v: deals.source })
      .from(deals)
      .where(
        and(
          eq(deals.pipelineId, board.pipeline.id),
          isNull(deals.deletedAt),
          sql`${deals.source} IS NOT NULL`
        )
      )
      .orderBy(asc(deals.source))
      .limit(100);
    return {
      ...board,
      contactNames,
      overdueDealIds: overdue,
      filters: { owners, sources: sources.map((s) => s.v as string) }
    };
  });
}
