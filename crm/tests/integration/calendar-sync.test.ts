import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeCalendarProvider } from '@/server/adapters/calendar/fake';
import { ProviderError } from '@/server/adapters/errors';
import {
  bookAppointment,
  CAL_PREFIX,
  pushAppointment,
  reconcileCalendar,
  registerCalendarSyncSubscribers,
  updateAppointment
} from '@/server/appointments';
import { createDb, type Db } from '@/server/db/client';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// KI-027 against a fake Cal.com. Thursday 09:00-17:00 PST is open.
let tdb: TestDatabase;
let appDb: Db;
let workerDb: Db;
let provider: FakeCalendarProvider;
let contactId: string;
const PHONE = '+15555550166';
const at = (hourUtc: number) => new Date(Date.UTC(2026, 10, 5, hourUtc));
let nextSlot = 0; // half-hour slots from 09:00 PST
const slot = () => {
  const start = new Date(at(17).getTime() + nextSlot * 30 * 60_000);
  nextSlot += 1;
  return { startsAt: start, endsAt: new Date(start.getTime() + 30 * 60_000) };
};
const row = async (id: string) => (await tdb.admin`select * from appointments where id = ${id}`)[0];
const push = (id: string, hint: 'booked' | 'updated' | 'cancelled') =>
  pushAppointment(IDS.tenantA, id, hint, { provider, db: workerDb });

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  appDb = createDb(tdb.app);
  workerDb = createDb(tdb.worker);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32),
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false'
  });
  await tdb.admin`update tenants set business_hours = ${tdb.admin.json({ thu: [{ open: '09:00', close: '17:00' }] })} where id = ${IDS.tenantA}`;
  const [c] =
    await tdb.admin`insert into contacts (tenant_id, first_name, last_name, primary_phone_e164, timezone)
    values (${IDS.tenantA}, 'Sync', 'Homeowner', ${PHONE}, 'America/Los_Angeles') returning id`;
  contactId = c.id;
  provider = new FakeCalendarProvider();
});
afterAll(async () => {
  clearSubscribers();
  await stopJobs();
  await tdb?.drop();
});

describe('portal to Cal.com', () => {
  it('pushes a new portal appointment once and links it', async () => {
    const a = await bookAppointment(
      ctx.ownerA(),
      { contactId, ...slot() },
      { db: appDb, bookedBy: 'user' }
    );
    expect(await push(a.id, 'booked')).toBe('created');
    const stored = (await row(a.id)).external_event_id as string;
    expect(stored).toMatch(new RegExp(`^${CAL_PREFIX}fake_cal_`));
    const booking = provider.bookings.get(stored.slice(CAL_PREFIX.length));
    expect(booking).toMatchObject({
      status: 'scheduled',
      attendeeName: 'Sync Homeowner',
      attendeePhoneE164: PHONE
    });
    // A repeat of the same event changes nothing.
    expect(await push(a.id, 'booked')).toBe('skipped');
    expect(provider.bookings.size).toBe(1);
  });

  it('moves and cancels the Cal.com booking, once each', async () => {
    const a = await bookAppointment(
      ctx.ownerA(),
      { contactId, ...slot() },
      { db: appDb, bookedBy: 'user' }
    );
    await push(a.id, 'booked');
    const first = (await row(a.id)).external_event_id as string;
    const moved = slot();
    await updateAppointment(ctx.ownerA(), a.id, moved, { db: appDb });
    expect(await push(a.id, 'updated')).toBe('rescheduled');
    const second = (await row(a.id)).external_event_id as string;
    expect(second).not.toBe(first);
    expect(provider.bookings.get(second.slice(CAL_PREFIX.length))?.startsAt).toEqual(
      moved.startsAt
    );
    expect(provider.bookings.get(first.slice(CAL_PREFIX.length))?.status).toBe('cancelled');
    // Retried job: Cal.com already has the new time.
    expect(await push(a.id, 'updated')).toBe('skipped');

    await updateAppointment(ctx.ownerA(), a.id, { status: 'cancelled' }, { db: appDb });
    expect(await push(a.id, 'cancelled')).toBe('cancelled');
    expect(provider.bookings.get(second.slice(CAL_PREFIX.length))?.status).toBe('cancelled');
    expect(await push(a.id, 'cancelled')).toBe('cancelled'); // cancelling twice is not an error
  });

  it('does not push a booking the n8n workflow already linked to Cal.com', async () => {
    const before = provider.requests.length;
    const a = await bookAppointment(
      ctx.ownerA(),
      { contactId, ...slot(), externalEventId: `${CAL_PREFIX}from_workflow` },
      { db: appDb }
    );
    expect(await push(a.id, 'booked')).toBe('skipped');
    expect(provider.requests.slice(before).some((r) => r.op === 'create')).toBe(false);
  });

  it('leaves the appointment unlinked when Cal.com is down, so the retry can finish', async () => {
    const a = await bookAppointment(
      ctx.ownerA(),
      { contactId, ...slot() },
      { db: appDb, bookedBy: 'user' }
    );
    provider.failNext = new ProviderError('transient', 'http_503', 'down');
    await expect(push(a.id, 'booked')).rejects.toThrow('down');
    expect((await row(a.id)).external_event_id).toBeNull();
    expect(await push(a.id, 'booked')).toBe('created');
  });

  it('runs from the appointment.booked event through the subscriber', async () => {
    clearSubscribers();
    registerCalendarSyncSubscribers({ provider, db: workerDb });
    const a = await bookAppointment(
      ctx.ownerA(),
      { contactId, ...slot() },
      { db: appDb, bookedBy: 'user' }
    );
    const [event] =
      await tdb.admin`select data from pgboss.job where name = 'event.dispatch' and data->>'name' = 'appointment.booked' and data->'payload'->>'appointmentId' = ${a.id}`;
    expect(await deliver(event.data as EventEnvelope, 'calendar-sync-push')).toBe('ran');
    expect((await row(a.id)).external_event_id).toMatch(/^calcom:/);
  });
});

describe('Cal.com to portal', () => {
  const range = { from: at(0), to: new Date(Date.UTC(2026, 10, 6)) };
  const reconcile = () => reconcileCalendar(IDS.tenantA, range, { provider, db: workerDb });

  it('mirrors a booking made in Cal.com, links the contact by phone, and does not duplicate', async () => {
    provider.addExternal({
      externalId: 'ext_1',
      startsAt: at(23),
      endsAt: at(24),
      attendeeName: 'Walk In',
      attendeePhoneE164: PHONE,
      attendeeEmail: null
    });
    expect(await reconcile()).toMatchObject({ created: 1 });
    const [local] =
      await tdb.admin`select * from appointments where external_event_id = 'calcom:ext_1'`;
    expect(local).toMatchObject({
      contact_id: contactId,
      booked_by: 'automation',
      status: 'scheduled'
    });
    expect(await reconcile()).toMatchObject({ created: 0, cancelled: 0, moved: 0 });
  });

  it('applies a cancellation and a move made in Cal.com', async () => {
    provider.addExternal({
      externalId: 'ext_2',
      startsAt: at(21),
      endsAt: at(22),
      attendeeName: 'Mover',
      attendeePhoneE164: null,
      attendeeEmail: null
    });
    await reconcile();
    provider.addExternal({
      externalId: 'ext_2',
      startsAt: new Date(at(21).getTime() + 30 * 60_000),
      endsAt: new Date(at(22).getTime() + 30 * 60_000),
      attendeeName: 'Mover',
      attendeePhoneE164: null,
      attendeeEmail: null
    });
    expect(await reconcile()).toMatchObject({ moved: 1 });
    provider.addExternal({
      externalId: 'ext_2',
      startsAt: new Date(at(21).getTime() + 30 * 60_000),
      endsAt: new Date(at(22).getTime() + 30 * 60_000),
      status: 'cancelled',
      attendeeName: 'Mover',
      attendeePhoneE164: null,
      attendeeEmail: null
    });
    expect(await reconcile()).toMatchObject({ cancelled: 1 });
    const [local] =
      await tdb.admin`select status from appointments where external_event_id = 'calcom:ext_2'`;
    expect(local.status).toBe('cancelled');
  });

  it('leaves a booking outside business hours for a person and counts it as rejected', async () => {
    provider.addExternal({
      externalId: 'ext_late',
      startsAt: at(5),
      endsAt: at(6),
      attendeeName: 'Late',
      attendeePhoneE164: null,
      attendeeEmail: null
    });
    expect(await reconcile()).toMatchObject({ rejected: 1 });
    const rows =
      await tdb.admin`select id from appointments where external_event_id = 'calcom:ext_late'`;
    expect(rows).toHaveLength(0);
  });
});
