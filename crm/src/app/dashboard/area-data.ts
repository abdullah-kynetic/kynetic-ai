import { headers } from 'next/headers';
import { contactsActorScope } from '@/server/contacts';
import { getDashboardMetrics, presetRange } from '@/server/metrics';
import { getBusinessSettings } from '@/server/settings/business';

/** Thirty-day metrics for a client area dashboard, or null when the user has no tenant access. */
export async function loadAreaMetrics() {
  const scope = await contactsActorScope(await headers());
  if (!scope) return null;
  const timeZone = (await getBusinessSettings(scope.ctx)).timezone;
  const range = presetRange(30, new Date(), timeZone);
  const metrics = await getDashboardMetrics(scope.ctx, range.from, range.to);
  return { ...scope, timeZone, range, metrics };
}

export const percentLabel = (value: number | null, empty = 'No leads yet') =>
  value == null ? empty : `${value}%`;
