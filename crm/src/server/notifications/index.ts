import { and, desc, eq, isNull, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { notifications } from '../db/schema';

export const NOTIFICATION_TYPES = [
  'new_lead',
  'booked',
  'task_due',
  'report_ready',
  'action_needed',
  'deal_won',
  'hot_lead'
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const inputSchema = z.object({
  /** Omit or null to notify every owner of the tenant (the row has user_id NULL). */
  userId: z.string().uuid().nullish(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1).nullish(),
  link: z.string().min(1).nullish()
});
export type NotifyInput = z.input<typeof inputSchema>;

/**
 * Creates one notification row inside the caller's transaction (ARCHITECTURE section 2), so it
 * commits or rolls back with the write that caused it. The tenant comes from the transaction's
 * context. The email and bell delivery belong to M7; this is the row.
 */
export async function notify(tx: Tx, input: NotifyInput): Promise<{ id: string }> {
  const i = inputSchema.parse(input);
  const [row] = await tx
    .insert(notifications)
    .values({
      tenantId: sql`app_tenant_id()`,
      userId: i.userId ?? null,
      kind: i.type,
      title: i.title,
      body: i.body ?? null,
      link: i.link ?? null
    })
    .returning({ id: notifications.id });
  return row;
}

// RLS scopes rows to the tenant only, so "own notifications only" is enforced here: reads and
// updates filter on the session user, which comes from the verified context and not a parameter.
const mine = or(eq(notifications.userId, sql`app_user_id()`), isNull(notifications.userId));

export function listMyNotifications(tx: Tx, opts: { unreadOnly?: boolean; limit?: number } = {}) {
  return tx
    .select()
    .from(notifications)
    .where(opts.unreadOnly ? and(mine, isNull(notifications.readAt)) : mine)
    .orderBy(desc(notifications.createdAt))
    .limit(opts.limit ?? 50);
}

export async function countMyUnread(tx: Tx): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(mine, isNull(notifications.readAt)));
  return row.n;
}

/** Returns false when the id is not one of the caller's notifications. */
export async function markNotificationRead(tx: Tx, id: string): Promise<boolean> {
  const rows = await tx
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(eq(notifications.id, id), mine))
    .returning({ id: notifications.id });
  return rows.length > 0;
}
