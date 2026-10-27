import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApi } from '@/server/security/with-api';
import {
  countMyUnread,
  listMyNotifications,
  NOTIFICATION_TABS,
  type NotificationTab,
  type NotificationType
} from '@/server/notifications';
import { withTenant } from '@/server/tenancy';
import { listLimitSchema, parseSearchParams } from '@/server/validation';
import { requireNotificationContext } from './context';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  tab: z
    .enum(Object.keys(NOTIFICATION_TABS) as [NotificationTab, ...NotificationTab[]])
    .default('all'),
  limit: listLimitSchema,
  before: z.iso.datetime({ offset: true }).optional()
});

// Own notifications only: the user id comes from the session inside notificationContext.
export const GET = withApi(async (request) => {
  const q = parseSearchParams(new URL(request.url), querySchema);
  const ctx = await requireNotificationContext();
  if (!ctx) return NextResponse.json({ ok: true, items: [], unread: 0 });
  const tab = NOTIFICATION_TABS[q.tab];
  const kinds = 'kinds' in tab ? (tab.kinds as readonly NotificationType[]) : undefined;
  const { items, unread } = await withTenant(ctx, async (tx) => ({
    items: await listMyNotifications(tx, {
      unreadOnly: q.tab === 'unread',
      kinds,
      limit: q.limit,
      before: q.before
    }),
    unread: await countMyUnread(tx)
  }));
  return NextResponse.json(
    { ok: true, items, unread },
    { headers: { 'Cache-Control': 'no-store' } }
  );
});
