import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { Tx } from '../db/client';
import { notifications } from '../db/schema';
import { ValidationError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { ownerUserId } from './owner';

// The owner's notifications for the service API (C12). Matches the portal's bell: the owner's own
// rows and tenant-wide rows, minus staff alerts for new support requests, which the admin page shows.

const mineFor = (userId: string) =>
  and(
    or(eq(notifications.userId, userId), isNull(notifications.userId)),
    sql`${notifications.kind} <> 'support_request'`
  );

/** Runs inside withServiceTenant. The unread count is always returned; `unreadOnly` filters the list. */
export async function listServiceNotifications(
  tx: Tx,
  svc: ServiceContext,
  opts: { unreadOnly?: boolean; limit?: number; before?: string } = {}
) {
  if (
    opts.limit !== undefined &&
    (!Number.isInteger(opts.limit) || opts.limit < 1 || opts.limit > 100)
  ) {
    throw new ValidationError({ limit: ['must be 1 to 100'] });
  }
  const userId = await ownerUserId(tx, svc);
  const mine = mineFor(userId);
  const [count] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(mine, isNull(notifications.readAt)));
  const items = await tx
    .select({
      id: notifications.id,
      kind: notifications.kind,
      title: notifications.title,
      body: notifications.body,
      link: notifications.link,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt
    })
    .from(notifications)
    .where(
      and(
        mine,
        opts.unreadOnly ? isNull(notifications.readAt) : undefined,
        opts.before ? lt(notifications.createdAt, opts.before) : undefined
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(opts.limit ?? 50);
  return { unread: count!.n, items };
}

/** Runs inside withServiceTenant. Marks the owner's unread notifications read; returns how many. */
export async function markServiceNotificationsRead(tx: Tx, svc: ServiceContext) {
  const userId = await ownerUserId(tx, svc);
  const rows = await tx
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(mineFor(userId), isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return { marked: rows.length };
}
