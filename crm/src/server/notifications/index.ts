import { and, desc, eq, inArray, isNull, lt, or, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { notifications } from '../db/schema';
import { enqueue } from '../jobs';

import { NOTIFICATION_TYPES, type NotificationType } from './types';

export { NOTIFICATION_TYPES, type NotificationType };
export { NOTIFICATION_TABS, type NotificationTab } from './tabs';

const inputSchema = z.object({
  /** Omit or null to notify every owner of the tenant (the row has user_id NULL). */
  userId: z.string().uuid().nullish(),
  type: z.enum(NOTIFICATION_TYPES),
  title: z.string().trim().min(1),
  body: z.string().trim().min(1).nullish(),
  link: z.string().min(1).nullish()
});
export type NotifyInput = z.input<typeof inputSchema>;

/** Queues the email for a notification in the caller's transaction (DC-078). */
export type EnqueueEmail = (
  tx: Tx,
  n: { tenantId: string; notificationId: string }
) => Promise<unknown>;

const enqueueNotificationEmail: EnqueueEmail = (tx, n) =>
  enqueue('notification.email', n, { tx, singletonKey: n.notificationId });

/**
 * Creates one notification row inside the caller's transaction (ARCHITECTURE section 2), so it
 * commits or rolls back with the write that caused it. The tenant comes from the transaction's
 * context. The email job joins the same transaction, so it exists only if the row commits; the bell
 * reads the row. `opts.enqueueEmail` is a seam for tests that run without the job queue.
 */
export async function notify(
  tx: Tx,
  input: NotifyInput,
  opts: { enqueueEmail?: EnqueueEmail } = {}
): Promise<{ id: string }> {
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
    .returning({ id: notifications.id, tenantId: notifications.tenantId });
  await (opts.enqueueEmail ?? enqueueNotificationEmail)(tx, {
    tenantId: row.tenantId,
    notificationId: row.id
  });
  return { id: row.id };
}

// RLS scopes rows to the tenant only, so "own notifications only" is enforced here: reads and
// updates filter on the session user, which comes from the verified context and not a parameter.
const mine = or(eq(notifications.userId, sql`app_user_id()`), isNull(notifications.userId));

export function listMyNotifications(
  tx: Tx,
  opts: {
    unreadOnly?: boolean;
    kinds?: readonly NotificationType[];
    limit?: number;
    before?: string;
  } = {}
) {
  return tx
    .select()
    .from(notifications)
    .where(
      and(
        mine,
        opts.unreadOnly ? isNull(notifications.readAt) : undefined,
        opts.kinds ? inArray(notifications.kind, [...opts.kinds]) : undefined,
        opts.before ? lt(notifications.createdAt, opts.before) : undefined
      )
    )
    .orderBy(desc(notifications.createdAt), desc(notifications.id))
    .limit(opts.limit ?? 50);
}

/** Marks every unread notification of the caller read; returns how many changed. */
export async function markAllMyNotificationsRead(tx: Tx): Promise<number> {
  const rows = await tx
    .update(notifications)
    .set({ readAt: sql`now()` })
    .where(and(mine, isNull(notifications.readAt)))
    .returning({ id: notifications.id });
  return rows.length;
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

export { deliverNotificationEmail, registerNotificationEmailWorker } from './email';
export {
  listMyPreferences,
  setMyPreferences,
  type NotificationPreference,
  type SetPreferencesInput
} from './preferences';
