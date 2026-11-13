import { describe, expect, it } from 'vitest';
import { CalcomCalendarProvider } from '@/server/adapters/calendar/calcom';
import { parseEnv } from '@/server/env';

// Request shapes only. Not verified against the live Cal.com API (see the adapter's header).
const calls: { url: string; init: RequestInit }[] = [];
const make = (status: number, body: unknown) =>
  new CalcomCalendarProvider({
    apiKey: 'cal_test',
    eventTypeId: 123,
    fetch: (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(JSON.stringify(body), { status });
    }) as unknown as typeof fetch
  });

describe('Cal.com adapter', () => {
  it('creates a booking with the event type, attendee and version header', async () => {
    calls.length = 0;
    const p = make(201, { status: 'success', data: { uid: 'abc' } });
    const r = await p.createBooking({
      tenantId: 't',
      appointmentId: 'a',
      startsAt: new Date('2026-11-05T20:00:00Z'),
      endsAt: new Date('2026-11-05T21:00:00Z'),
      name: 'Demo Person',
      phoneE164: '+15555550100',
      email: null,
      timeZone: 'America/Los_Angeles',
      notes: null,
      idempotencyKey: 'k'
    });
    expect(r).toEqual({ externalId: 'abc' });
    expect(calls[0]!.url).toBe('https://api.cal.com/v2/bookings');
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers['cal-api-version']).toBe('2024-08-13');
    expect(headers.authorization).toBe('Bearer cal_test');
    expect(JSON.parse(calls[0]!.init.body as string)).toMatchObject({
      eventTypeId: 123,
      start: '2026-11-05T20:00:00.000Z',
      attendee: { name: 'Demo Person', phoneNumber: '+15555550100' }
    });
  });

  it('maps errors by status and never keeps the response body', async () => {
    await expect(
      make(401, { secret: 'x' }).cancelBooking({ externalId: 'u', reason: 'r' })
    ).rejects.toMatchObject({
      kind: 'config',
      code: 'http_401'
    });
    await expect(
      make(503, {}).cancelBooking({ externalId: 'u', reason: 'r' })
    ).rejects.toMatchObject({
      kind: 'transient'
    });
    await expect(
      make(400, {}).cancelBooking({ externalId: 'u', reason: 'r' })
    ).rejects.toMatchObject({
      kind: 'permanent'
    });
  });

  it('reads a booking list', async () => {
    const p = make(200, {
      data: [
        {
          uid: 'u1',
          start: '2026-11-05T20:00:00Z',
          end: '2026-11-05T21:00:00Z',
          status: 'accepted',
          attendees: [{ name: 'A', phoneNumber: '+15555550100' }]
        },
        {
          uid: 'u2',
          start: '2026-11-06T20:00:00Z',
          end: '2026-11-06T21:00:00Z',
          status: 'cancelled'
        },
        { nope: true }
      ]
    });
    const list = await p.listBookings({ from: new Date('2026-11-01'), to: new Date('2026-12-01') });
    expect(list.map((b) => [b.externalId, b.status])).toEqual([
      ['u1', 'scheduled'],
      ['u2', 'cancelled']
    ]);
  });

  it('refuses to enable sync without the key and event type', () => {
    const base = {
      NODE_ENV: 'test',
      APP_BASE_URL: 'http://localhost:3000',
      DATABASE_URL: 'postgres://x',
      DATABASE_URL_AUTH: 'postgres://x',
      BETTER_AUTH_SECRET: 'x'.repeat(32),
      APP_ENCRYPTION_KEY: 'y'.repeat(32)
    };
    expect(() => parseEnv({ ...base, CALCOM_SYNC_ENABLED: 'true' })).toThrow(/CAL_API_KEY/);
    expect(
      parseEnv({
        ...base,
        CALCOM_SYNC_ENABLED: 'true',
        CAL_API_KEY: 'k',
        CAL_EVENT_TYPE_ID: '7520336'
      }).CAL_EVENT_TYPE_ID
    ).toBe(7520336);
    expect(parseEnv(base).CALCOM_SYNC_ENABLED).toBe(false);
  });
});
