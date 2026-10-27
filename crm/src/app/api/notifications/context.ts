import { cookies, headers } from 'next/headers';
import { AppError } from '@/server/errors';
import { notificationContext } from '@/server/notifications/request';

/** Session to tenant context for the notification routes; throws the standard 401 when signed out. */
export async function requireNotificationContext() {
  const [h, c] = await Promise.all([headers(), cookies()]);
  const { signedIn, ctx } = await notificationContext(h, c.get('tenant_id')?.value);
  if (!signedIn) throw new AppError('UNAUTHENTICATED');
  return ctx;
}
