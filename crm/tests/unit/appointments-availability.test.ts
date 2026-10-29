import { describe, expect, it } from 'vitest';
import { availableSlots } from '@/server/appointments';

const hours = {
  mon: [{ open: '09:00', close: '12:00' }],
  sun: [{ open: '09:00', close: '12:00' }]
};

describe('M5-01 appointment availability', () => {
  it('returns slots in the tenant timezone and excludes buffered appointments', () => {
    const slots = availableSlots({
      hours,
      timezone: 'America/Los_Angeles',
      from: new Date('2026-11-02T17:00:00Z'),
      to: new Date('2026-11-02T21:00:00Z'),
      durationMinutes: 60,
      bufferMinutes: 15,
      slotMinutes: 60,
      existing: [
        { startsAt: new Date('2026-11-02T19:00:00Z'), endsAt: new Date('2026-11-02T20:00:00Z') }
      ]
    });
    expect(slots).toEqual([new Date('2026-11-02T17:00:00Z')]);
  });

  it('handles DST without treating a closed local time as available', () => {
    const slots = availableSlots({
      hours: { sun: [{ open: '01:00', close: '04:00' }] },
      timezone: 'America/Los_Angeles',
      from: new Date('2026-03-08T08:00:00Z'),
      to: new Date('2026-03-08T12:00:00Z'),
      durationMinutes: 60,
      slotMinutes: 60
    });
    expect(slots.map((s) => s.toISOString())).toEqual([
      '2026-03-08T09:00:00.000Z',
      '2026-03-08T10:00:00.000Z'
    ]);
  });

  it('returns no slots for invalid zones, closed days or invalid ranges', () => {
    expect(
      availableSlots({
        hours,
        timezone: 'Not/AZone',
        from: new Date('2026-11-02T17:00:00Z'),
        to: new Date('2026-11-02T21:00:00Z'),
        durationMinutes: 60
      })
    ).toEqual([]);
    expect(
      availableSlots({
        hours,
        timezone: 'America/Los_Angeles',
        from: new Date('2026-11-03T17:00:00Z'),
        to: new Date('2026-11-03T21:00:00Z'),
        durationMinutes: 60
      })
    ).toEqual([]);
  });
});
