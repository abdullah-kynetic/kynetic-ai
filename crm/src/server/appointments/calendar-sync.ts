import { and, eq, isNull } from 'drizzle-orm';
import { ProviderError } from '../adapters/errors';
import { CalcomCalendarProvider } from '../adapters/calendar/calcom';
import type { CalendarProvider } from '../adapters/calendar/types';
import { recordActivity } from '../activity';
import { getWorkerDb, type Db } from '../db/client';
import { appointments, contacts, tenants } from '../db/schema';
import { getEnv } from '../env';
import { AppError } from '../errors';
import { subscribe, type EventEnvelope } from '../events';
import { registerWorker, scheduleRecurring } from '../jobs';
import { listScheduledTenants } from '../schedules';
import { withTenant } from '../tenancy';
import { bookAppointment, updateAppointment } from './service';

// KI-027. Two-way sync between the portal calendar and Cal.com.
//   Portal to Cal.com: a booked, moved or cancelled portal appointment is pushed (event subscribers).
//   Cal.com to portal: `reconcileCalendar` mirrors bookings made or changed in Cal.com.
// An appointment linked to Cal.com carries `external_event_id = "calcom:<uid>"`. The n8n booking
// workflow sends that same value when it books, so a workflow booking is never pushed back.
// Nothing runs unless PROVIDER_MODE is live and CALCOM_SYNC_ENABLED is true with both Cal.com values
// set. Turning it on in production is a live change that needs a yes.

export const CAL_PREFIX = 'calcom:';
export const CALENDAR_SYNC_SUBSCRIBER = 'calendar-sync-push';
export const CALENDAR_RECONCILE_CRON = '*/15 * * * *';
const DAY_MS = 86_400_000;

/**
 * The provider this process syncs with, or null when sync is off. Stub mode never syncs: the portal
 * runs in stub mode until go-live, and a fake must not link real appointments. Tests pass the fake in.
 */
export function getCalendarProvider(): CalendarProvider | null {
  const env = getEnv();
  if (env.PROVIDER_MODE === 'stub') return null;
  if (!env.CALCOM_SYNC_ENABLED || !env.CAL_API_KEY || !env.CAL_EVENT_TYPE_ID) return null;
  return new CalcomCalendarProvider({
    apiKey: env.CAL_API_KEY,
    eventTypeId: env.CAL_EVENT_TYPE_ID
  });
}

export type PushResult = 'created' | 'rescheduled' | 'cancelled' | 'skipped';
type Deps = { db?: Db; provider: CalendarProvider };

const ownedByCalendar = (id: string | null) => !!id && id.startsWith(CAL_PREFIX);
const uidOf = (id: string) => id.slice(CAL_PREFIX.length);
const sameInstant = (a: Date | string, b: Date | string) =>
  new Date(a).getTime() === new Date(b).getTime();

/**
 * Pushes one portal appointment to Cal.com. `hint` is the event that triggered it: a booking that
 * already carries a Cal.com id came from the calendar, so there is nothing to send.
 */
export async function pushAppointment(
  tenantId: string,
  appointmentId: string,
  hint: 'booked' | 'updated' | 'cancelled',
  deps: Deps
): Promise<PushResult> {
  const db = deps.db ?? getWorkerDb();
  const ctx = { tenantId, role: 'system' as const };
  const snap = await withTenant(
    ctx,
    async (tx) => {
      const [a] = await tx
        .select()
        .from(appointments)
        .where(eq(appointments.id, appointmentId))
        .limit(1);
      if (!a) return null;
      const [c] = a.contactId
        ? await tx.select().from(contacts).where(eq(contacts.id, a.contactId)).limit(1)
        : [];
      const [t] = await tx
        .select({ timezone: tenants.timezone })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      return { a, c, timezone: t?.timezone ?? 'UTC' };
    },
    { db }
  );
  if (!snap) return 'skipped';
  const { a, c } = snap;
  const note = (summary: string) =>
    withTenant(
      ctx,
      (tx) =>
        recordActivity(tx, {
          contactId: a.contactId ?? undefined,
          dealId: a.dealId ?? undefined,
          type: 'system',
          summary,
          actor: { type: 'system' },
          meta: { check: 'calendar_sync', appointmentId }
        }),
      { db }
    );
  const link = (externalId: string) =>
    withTenant(
      ctx,
      (tx) =>
        tx
          .update(appointments)
          .set({ externalEventId: `${CAL_PREFIX}${externalId}` })
          .where(and(eq(appointments.id, appointmentId))),
      { db }
    );

  if (a.status === 'cancelled') {
    if (!ownedByCalendar(a.externalEventId)) return 'skipped';
    try {
      await deps.provider.cancelBooking({
        externalId: uidOf(a.externalEventId!),
        reason: 'Cancelled in the client portal'
      });
    } catch (e) {
      // Already cancelled or gone in Cal.com: the calendars agree, so this is done.
      if (e instanceof ProviderError && e.kind === 'permanent') return 'skipped';
      throw e;
    }
    await note('Cancelled in Cal.com');
    return 'cancelled';
  }
  if (a.status !== 'scheduled') return 'skipped';

  if (!a.externalEventId) {
    const name = [c?.firstName, c?.lastName].filter(Boolean).join(' ') || 'Client contact';
    const { externalId } = await deps.provider.createBooking({
      tenantId,
      appointmentId,
      startsAt: new Date(a.startsAt),
      endsAt: new Date(a.endsAt),
      name,
      phoneE164: c?.primaryPhoneE164 ?? null,
      email: c?.primaryEmail ?? null,
      timeZone: c?.timezone ?? snap.timezone,
      notes: a.notes ?? null,
      idempotencyKey: `portal-appt:${appointmentId}`
    });
    await link(externalId);
    await note('Added to Cal.com');
    return 'created';
  }

  if (!ownedByCalendar(a.externalEventId) || hint === 'booked') return 'skipped';
  // Moved in the portal: compare with Cal.com first so a retried job never moves it twice.
  const uid = uidOf(a.externalEventId);
  const from = new Date(new Date(a.startsAt).getTime() - 30 * DAY_MS);
  const to = new Date(new Date(a.endsAt).getTime() + 30 * DAY_MS);
  const remote = (await deps.provider.listBookings({ from, to })).find((b) => b.externalId === uid);
  if (remote && sameInstant(remote.startsAt, a.startsAt)) return 'skipped';
  const { externalId } = await deps.provider.rescheduleBooking({
    externalId: uid,
    startsAt: new Date(a.startsAt),
    endsAt: new Date(a.endsAt),
    idempotencyKey: `portal-appt:${appointmentId}:${new Date(a.startsAt).toISOString()}`
  });
  await link(externalId);
  await note('Moved in Cal.com');
  return 'rescheduled';
}

export type ReconcileResult = {
  created: number;
  cancelled: number;
  moved: number;
  rejected: number;
};

/** Mirrors Cal.com bookings made or changed outside the portal. Idempotent. */
export async function reconcileCalendar(
  tenantId: string,
  range: { from: Date; to: Date },
  deps: Deps
): Promise<ReconcileResult> {
  const db = deps.db ?? getWorkerDb();
  const ctx = { tenantId, role: 'system' as const };
  const out: ReconcileResult = { created: 0, cancelled: 0, moved: 0, rejected: 0 };
  for (const b of await deps.provider.listBookings(range)) {
    const ext = `${CAL_PREFIX}${b.externalId}`;
    await withTenant(
      ctx,
      async (tx) => {
        const [local] = await tx
          .select()
          .from(appointments)
          .where(eq(appointments.externalEventId, ext))
          .limit(1);
        if (!local) {
          if (b.status !== 'scheduled') return;
          const [contact] = b.attendeePhoneE164
            ? await tx
                .select({ id: contacts.id })
                .from(contacts)
                .where(
                  and(
                    eq(contacts.primaryPhoneE164, b.attendeePhoneE164),
                    isNull(contacts.deletedAt),
                    isNull(contacts.mergedIntoId)
                  )
                )
                .limit(1)
            : [];
          try {
            await bookAppointment(
              ctx,
              {
                contactId: contact?.id ?? null,
                startsAt: b.startsAt,
                endsAt: b.endsAt,
                externalEventId: ext,
                notes: 'Booked in Cal.com.'
              },
              { tx, bookedBy: 'automation' }
            );
            out.created++;
          } catch (e) {
            // Outside business hours or overlapping another appointment: leave it for a person.
            if (e instanceof AppError || (e as Error).name === 'ValidationError') out.rejected++;
            else throw e;
          }
          return;
        }
        if (local.status === 'scheduled' && b.status === 'cancelled') {
          await updateAppointment(ctx, local.id, { status: 'cancelled' }, { tx });
          out.cancelled++;
        } else if (
          local.status === 'scheduled' &&
          b.status === 'scheduled' &&
          !sameInstant(local.startsAt, b.startsAt)
        ) {
          try {
            await updateAppointment(
              ctx,
              local.id,
              { startsAt: b.startsAt, endsAt: b.endsAt },
              { tx }
            );
            out.moved++;
          } catch (e) {
            if (e instanceof AppError || (e as Error).name === 'ValidationError') out.rejected++;
            else throw e;
          }
        }
      },
      { db }
    );
  }
  return out;
}

export function registerCalendarSyncSubscribers(
  deps: { provider?: CalendarProvider | null; db?: Db } = {}
): void {
  const provider = deps.provider === undefined ? getCalendarProvider() : deps.provider;
  if (!provider) return;
  for (const [name, hint] of [
    ['appointment.booked', 'booked'],
    ['appointment.updated', 'updated'],
    ['appointment.cancelled', 'cancelled']
  ] as const) {
    subscribe(name, CALENDAR_SYNC_SUBSCRIBER, async (env: EventEnvelope) => {
      const id = env.payload.appointmentId;
      if (typeof id !== 'string') return;
      await pushAppointment(env.tenantId, id, hint, { provider, db: deps.db });
    });
  }
}

export async function registerCalendarReconcileWorker(): Promise<void> {
  await registerWorker('calendar.reconcile', async () => {
    const provider = getCalendarProvider();
    if (!provider) return;
    const now = Date.now();
    for (const t of await listScheduledTenants()) {
      await reconcileCalendar(
        t.tenantId,
        { from: new Date(now - DAY_MS), to: new Date(now + 60 * DAY_MS) },
        { provider }
      );
    }
  });
}

export async function scheduleCalendarReconcile(): Promise<void> {
  await scheduleRecurring(
    'worker',
    'calendar.reconcile',
    CALENDAR_RECONCILE_CRON,
    {},
    'calendar-reconcile'
  );
}
