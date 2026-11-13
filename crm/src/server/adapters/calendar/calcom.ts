import { ProviderError, type ProviderErrorKind } from '../errors';
import type { CalendarBooking, CalendarBookingInput, CalendarProvider } from './types';

// Cal.com API v2. NOT verified against the live API: no Cal.com key has been used from this code, and
// every request shape below is from the public docs. The first live use needs Abdullah's yes and a
// check against a test event type (docs/phases/phase-6.md, P6-S5).

const BASE_URL = 'https://api.cal.com';
const API_VERSION = '2024-08-13';

export type CalcomOptions = {
  apiKey: string;
  eventTypeId: number;
  baseUrl?: string;
  fetch?: typeof fetch;
};

function kindFor(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return 'config';
  if (status === 408 || status === 429 || status >= 500) return 'transient';
  return 'permanent';
}

type Dict = Record<string, unknown>;
const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

export class CalcomCalendarProvider implements CalendarProvider {
  readonly id = 'calcom' as const;
  private readonly baseUrl: string;
  private readonly doFetch: typeof fetch;

  constructor(private readonly opts: CalcomOptions) {
    this.baseUrl = (opts.baseUrl ?? BASE_URL).replace(/\/+$/, '');
    this.doFetch = opts.fetch ?? fetch;
  }

  private async call(method: 'GET' | 'POST', path: string, body?: unknown): Promise<Dict> {
    let res: Response;
    try {
      res = await this.doFetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${this.opts.apiKey}`,
          'cal-api-version': API_VERSION,
          'content-type': 'application/json'
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        redirect: 'error'
      });
    } catch {
      throw new ProviderError('transient', 'network', 'Cal.com could not be reached');
    }
    if (!res.ok) {
      // The body can echo attendee details, so only the status is kept.
      throw new ProviderError(
        kindFor(res.status),
        `http_${res.status}`,
        `Cal.com answered ${res.status}`
      );
    }
    const json: unknown = await res.json().catch(() => null);
    if (!isDict(json)) throw new ProviderError('permanent', 'bad_response', 'Cal.com sent no JSON');
    return json;
  }

  async createBooking(i: CalendarBookingInput) {
    const json = await this.call('POST', '/v2/bookings', {
      start: i.startsAt.toISOString(),
      eventTypeId: this.opts.eventTypeId,
      attendee: {
        name: i.name,
        timeZone: i.timeZone,
        ...(i.phoneE164 ? { phoneNumber: i.phoneE164 } : {}),
        ...(i.email ? { email: i.email } : {})
      },
      metadata: { portalAppointmentId: i.appointmentId, idempotencyKey: i.idempotencyKey },
      ...(i.notes ? { bookingFieldsResponses: { notes: i.notes } } : {})
    });
    const uid = isDict(json.data) ? str(json.data.uid) : null;
    if (!uid) throw new ProviderError('permanent', 'bad_response', 'Cal.com booking had no uid');
    return { externalId: uid };
  }

  async rescheduleBooking(i: { externalId: string; startsAt: Date }) {
    const json = await this.call(
      'POST',
      `/v2/bookings/${encodeURIComponent(i.externalId)}/reschedule`,
      { start: i.startsAt.toISOString(), reschedulingReason: 'Moved in the client portal' }
    );
    const uid = isDict(json.data) ? str(json.data.uid) : null;
    if (!uid) throw new ProviderError('permanent', 'bad_response', 'Cal.com reschedule had no uid');
    return { externalId: uid };
  }

  async cancelBooking(i: { externalId: string; reason: string }) {
    await this.call('POST', `/v2/bookings/${encodeURIComponent(i.externalId)}/cancel`, {
      cancellationReason: i.reason
    });
  }

  async listBookings(i: { from: Date; to: Date }): Promise<CalendarBooking[]> {
    const q = new URLSearchParams({
      afterStart: i.from.toISOString(),
      beforeEnd: i.to.toISOString(),
      status: 'upcoming,cancelled',
      take: '100'
    });
    const json = await this.call('GET', `/v2/bookings?${q}`);
    const rows = Array.isArray(json.data) ? json.data : [];
    return rows.flatMap((row): CalendarBooking[] => {
      if (!isDict(row)) return [];
      const uid = str(row.uid);
      const start = str(row.start);
      const end = str(row.end);
      if (!uid || !start || !end) return [];
      const attendee =
        Array.isArray(row.attendees) && isDict(row.attendees[0]) ? row.attendees[0] : {};
      return [
        {
          externalId: uid,
          startsAt: new Date(start),
          endsAt: new Date(end),
          status: row.status === 'cancelled' ? 'cancelled' : 'scheduled',
          attendeeName: str(attendee.name),
          attendeePhoneE164: str(attendee.phoneNumber),
          attendeeEmail: str(attendee.email)
        }
      ];
    });
  }
}
