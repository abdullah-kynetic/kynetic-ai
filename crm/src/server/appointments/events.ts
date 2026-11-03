import { and, eq } from 'drizzle-orm';
import { appointments, notifications } from '../db/schema';
import { subscribe, type EventEnvelope } from '../events';
import { getWorkerDb } from '../db/client';
import { notify } from '../notifications';
import { withTenant } from '../tenancy';

export const APPOINTMENT_NOTIFICATION_SUBSCRIBER = 'appointment-booked-notification';

export function registerAppointmentSubscriber(): void {
  subscribe(
    'appointment.booked',
    APPOINTMENT_NOTIFICATION_SUBSCRIBER,
    async (env: EventEnvelope) => {
      const id = env.payload.appointmentId;
      if (typeof id !== 'string') return;
      await withTenant(
        { tenantId: env.tenantId, role: 'system' },
        async (tx) => {
          const [appointment] = await tx
            .select()
            .from(appointments)
            .where(eq(appointments.id, id))
            .limit(1);
          if (!appointment) return;
          const link = `/dashboard/appointments?appointment=${appointment.id}`;
          const [already] = await tx
            .select({ id: notifications.id })
            .from(notifications)
            .where(and(eq(notifications.kind, 'booked'), eq(notifications.link, link)))
            .limit(1);
          if (!already)
            await notify(tx, {
              type: 'booked',
              userId: null,
              title: 'New appointment booked',
              body: 'Alex booked a new appointment for your team.',
              link
            });
        },
        { db: getWorkerDb() }
      );
    }
  );
}
