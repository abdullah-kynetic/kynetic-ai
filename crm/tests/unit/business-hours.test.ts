import { describe, expect, it } from 'vitest';
import {
  businessHoursSchema,
  dayBounds,
  isWithinBusinessHours,
  serviceAreaSchema,
  servicesSchema
} from '@/server/settings';

const hours = businessHoursSchema.parse({
  mon: [
    { open: '08:00', close: '12:00' },
    { open: '13:00', close: '17:00' }
  ],
  sat: [{ open: '09:00', close: '13:00' }]
});
const tz = 'America/Los_Angeles';

describe('isWithinBusinessHours (F-41)', () => {
  it('is open inside a window in the tenant time zone', () => {
    // Mon 2026-10-26 10:00 PDT = 17:00Z
    expect(isWithinBusinessHours(hours, tz, new Date('2026-10-26T17:00:00Z'))).toBe(true);
  });
  it('is closed at the window end, at lunch and on a closed day', () => {
    expect(isWithinBusinessHours(hours, tz, new Date('2026-10-26T19:00:00Z'))).toBe(false); // 12:00
    expect(isWithinBusinessHours(hours, tz, new Date('2026-10-26T19:30:00Z'))).toBe(false); // 12:30
    expect(isWithinBusinessHours(hours, tz, new Date('2026-10-27T17:00:00Z'))).toBe(false); // Tue
  });
  it('uses the tenant zone, not UTC: Mon 08:00 PDT is Mon 15:00Z', () => {
    expect(isWithinBusinessHours(hours, tz, new Date('2026-10-26T15:00:00Z'))).toBe(true);
    expect(isWithinBusinessHours(hours, tz, new Date('2026-10-26T14:59:00Z'))).toBe(false);
  });
  it('empty hours or a bad zone are closed', () => {
    expect(isWithinBusinessHours({}, tz, new Date('2026-10-26T17:00:00Z'))).toBe(false);
    expect(isWithinBusinessHours(hours, 'Not/AZone', new Date('2026-10-26T17:00:00Z'))).toBe(false);
  });
  it('dayBounds lists the local day windows', () => {
    expect(dayBounds(hours, tz, new Date('2026-10-26T17:00:00Z'))).toEqual([
      { startMinute: 480, endMinute: 720 },
      { startMinute: 780, endMinute: 1020 }
    ]);
    expect(dayBounds(hours, tz, new Date('2026-10-27T17:00:00Z'))).toEqual([]);
  });
});

describe('settings schemas', () => {
  it('refuses reversed, overlapping and malformed windows and unknown days', () => {
    for (const bad of [
      { mon: [{ open: '17:00', close: '08:00' }] },
      {
        mon: [
          { open: '08:00', close: '12:00' },
          { open: '11:00', close: '14:00' }
        ]
      },
      { mon: [{ open: '8am', close: '5pm' }] },
      { monday: [] }
    ]) {
      expect(businessHoursSchema.safeParse(bad).success).toBe(false);
    }
  });
  it('accepts zips or radius and refuses bad zips', () => {
    expect(serviceAreaSchema.safeParse({ type: 'zips', zips: ['90210'] }).success).toBe(true);
    expect(
      serviceAreaSchema.safeParse({ type: 'radius', centerZip: '90210', miles: 25 }).success
    ).toBe(true);
    expect(serviceAreaSchema.safeParse({ type: 'zips', zips: ['9021'] }).success).toBe(false);
    expect(
      serviceAreaSchema.safeParse({ type: 'radius', centerZip: '90210', miles: 0 }).success
    ).toBe(false);
  });
  it('services are trimmed and unique ignoring case', () => {
    expect(servicesSchema.parse([' Roof repair '])).toEqual(['Roof repair']);
    expect(servicesSchema.safeParse(['Roofing', 'roofing']).success).toBe(false);
  });
});
