import { ProviderError } from '../errors';
import type { CalendarBooking, CalendarBookingInput, CalendarProvider } from './types';

/** In-memory Cal.com stand-in for tests and stub mode. No network. */
export class FakeCalendarProvider implements CalendarProvider {
  readonly id = 'calcom' as const;
  readonly bookings = new Map<string, CalendarBooking>();
  readonly requests: { op: string; arg: unknown }[] = [];
  /** Set to make the next call fail, as a provider outage would. */
  failNext: ProviderError | null = null;
  private readonly byKey = new Map<string, string>();
  private seq = 0;

  private maybeFail() {
    if (this.failNext) {
      const e = this.failNext;
      this.failNext = null;
      throw e;
    }
  }

  async createBooking(i: CalendarBookingInput) {
    this.requests.push({ op: 'create', arg: i });
    this.maybeFail();
    const existing = this.byKey.get(i.idempotencyKey);
    if (existing) return { externalId: existing };
    const externalId = `fake_cal_${++this.seq}`;
    this.byKey.set(i.idempotencyKey, externalId);
    this.bookings.set(externalId, {
      externalId,
      startsAt: i.startsAt,
      endsAt: i.endsAt,
      status: 'scheduled',
      attendeeName: i.name,
      attendeePhoneE164: i.phoneE164,
      attendeeEmail: i.email
    });
    return { externalId };
  }

  async rescheduleBooking(i: {
    externalId: string;
    startsAt: Date;
    endsAt: Date;
    idempotencyKey: string;
  }) {
    this.requests.push({ op: 'reschedule', arg: i });
    this.maybeFail();
    const done = this.byKey.get(i.idempotencyKey);
    if (done) return { externalId: done };
    const old = this.bookings.get(i.externalId);
    if (!old) throw new ProviderError('permanent', 'not_found', 'Booking not found');
    const externalId = `fake_cal_${++this.seq}`;
    this.bookings.set(i.externalId, { ...old, status: 'cancelled' });
    this.bookings.set(externalId, { ...old, externalId, startsAt: i.startsAt, endsAt: i.endsAt });
    this.byKey.set(i.idempotencyKey, externalId);
    return { externalId };
  }

  async cancelBooking(i: { externalId: string; reason: string }) {
    this.requests.push({ op: 'cancel', arg: i });
    this.maybeFail();
    const b = this.bookings.get(i.externalId);
    if (!b) throw new ProviderError('permanent', 'not_found', 'Booking not found');
    this.bookings.set(i.externalId, { ...b, status: 'cancelled' });
  }

  async listBookings(i: { from: Date; to: Date }) {
    this.requests.push({ op: 'list', arg: i });
    this.maybeFail();
    return [...this.bookings.values()].filter((b) => b.startsAt < i.to && b.endsAt > i.from);
  }

  /** Test helper: a booking made directly in Cal.com, outside the portal. */
  addExternal(b: Omit<CalendarBooking, 'status'> & { status?: CalendarBooking['status'] }) {
    this.bookings.set(b.externalId, { status: 'scheduled', ...b });
  }
}
