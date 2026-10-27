import { NextResponse } from 'next/server';
import { withApi } from '@/server/security/with-api';
import { markAllMyNotificationsRead } from '@/server/notifications';
import { withTenant } from '@/server/tenancy';
import { requireNotificationContext } from '../context';

export const dynamic = 'force-dynamic';

export const POST = withApi(async () => {
  const ctx = await requireNotificationContext();
  if (!ctx) return NextResponse.json({ ok: true, unread: 0 });
  await withTenant(ctx, (tx) => markAllMyNotificationsRead(tx));
  return NextResponse.json({ ok: true, unread: 0 });
});
