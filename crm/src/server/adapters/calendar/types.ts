export type CalendarBookingInput = {
  tenantId: string;
  appointmentId: string;
  startsAt: Date;
  endsAt: Date;
  name: string;
  phoneE164: string | null;
  email: string | null;
  timeZone: string;
  notes: string | null;
  /** Same key, same booking: a retried push never makes a second one. */
  idempotencyKey: string;
};

export type CalendarBooking = {
  /** The calendar's own id for the booking (the Cal.com `uid`). */
  externalId: string;
  startsAt: Date;
  endsAt: Date;
  status: 'scheduled' | 'cancelled';
  attendeeName: string | null;
  attendeePhoneE164: string | null;
  attendeeEmail: string | null;
};

/** The outside calendar the portal syncs with. Cal.com is the only real implementation (KI-027). */
export interface CalendarProvider {
  readonly id: 'calcom';
  createBooking(i: CalendarBookingInput): Promise<{ externalId: string }>;
  /** Cal.com issues a new id when a booking moves, so the caller stores the one returned. */
  rescheduleBooking(i: {
    externalId: string;
    startsAt: Date;
    endsAt: Date;
    idempotencyKey: string;
  }): Promise<{ externalId: string }>;
  cancelBooking(i: { externalId: string; reason: string }): Promise<void>;
  listBookings(i: { from: Date; to: Date }): Promise<CalendarBooking[]>;
}
