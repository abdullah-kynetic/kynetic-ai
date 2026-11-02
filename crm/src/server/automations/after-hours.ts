import { and, eq } from 'drizzle-orm';
import { getWorkerDb } from '../db/client';
import { calls, notifications, tenants } from '../db/schema';
import { subscribe } from '../events';
import { notify } from '../notifications';
import { businessHoursSchema, isWithinBusinessHours } from '../settings/hours';
import { withTenant } from '../tenancy';

/** F-80: notify staff once when an inbound call arrived outside configured hours. */
export function registerAfterHoursSubscriber(): void {
  subscribe(
    'call.completed',
    'after-hours-call-alert',
    async (env) => {
      if (env.payload.direction !== 'inbound') return;
      const callId = env.payload.callId;
      const startedAt = env.payload.startedAt;
      if (typeof callId !== 'string' || typeof startedAt !== 'string') return;

      await withTenant(
        { tenantId: env.tenantId, role: 'system' },
        async (tx) => {
          const [call] = await tx
            .select({
              contactId: calls.contactId,
              tenantTimezone: tenants.timezone,
              businessHours: tenants.businessHours
            })
            .from(calls)
            .innerJoin(tenants, eq(tenants.id, calls.tenantId))
            .where(and(eq(calls.id, callId), eq(calls.tenantId, env.tenantId)))
            .limit(1);
          if (!call) return;
          const hours = businessHoursSchema.safeParse(call.businessHours);
          const hasConfiguredHours =
            hours.success &&
            Object.values(hours.data).some((windows) => (windows?.length ?? 0) > 0);
          if (
            !hasConfiguredHours ||
            isWithinBusinessHours(hours.data, call.tenantTimezone, new Date(startedAt))
          ) {
            return;
          }

          const link = `/dashboard/calls/${callId}`;
          const [existing] = await tx
            .select({ id: notifications.id })
            .from(notifications)
            .where(and(eq(notifications.kind, 'action_needed'), eq(notifications.link, link)))
            .limit(1);
          if (existing) return;

          await notify(tx, {
            type: 'action_needed',
            title: 'After-hours call received',
            body: call.contactId
              ? 'An inbound call arrived outside business hours. Follow up with the contact.'
              : 'An inbound call arrived outside business hours and needs follow-up.',
            link
          });
        },
        { db: getWorkerDb() }
      );
    },
    { module: 'after_hours' }
  );
}
