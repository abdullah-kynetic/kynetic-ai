import { NextResponse } from 'next/server';
import { AppError } from '@/server/errors';
import { withApi } from '@/server/security/with-api';
import { countMyUnread, markNotificationRead } from '@/server/notifications';
import { withTenant } from '@/server/tenancy';
import { uuidSchema } from '@/server/validation';
import { requireNotificationContext } from '../../context';

export const dynamic = 'force-dynamic';

// Someone else's id is indistinguishable from a missing one: NOT_FOUND either way.
export const POST = withApi(async (_request, { params }: { params: Promise<{ id: string }> }) => {
  const id = uuidSchema.safeParse((await params).id);
  if (!id.success) throw new AppError('NOT_FOUND');
  const ctx = await requireNotificationContext();
  if (!ctx) throw new AppError('NOT_FOUND');
  const unread = await withTenant(ctx, async (tx) => {
    if (!(await markNotificationRead(tx, id.data))) throw new AppError('NOT_FOUND');
    return countMyUnread(tx);
  });
  return NextResponse.json({ ok: true, unread });
});
