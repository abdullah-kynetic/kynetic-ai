import { describe, expect, it } from 'vitest';
import { weekStart } from '@/server/shop/money';

describe('weekStart', () => {
  it('returns Monday 00:00 local time as a UTC instant', () => {
    // Wednesday 2026-11-25 in Dallas (CST, UTC-6): Monday 11-23 00:00 CST is 06:00Z.
    expect(weekStart(new Date('2026-11-25T18:00:00Z'), 'America/Chicago').toISOString()).toBe(
      '2026-11-23T06:00:00.000Z'
    );
    // Pacific (UTC-8) the same week.
    expect(weekStart(new Date('2026-11-25T18:00:00Z'), 'America/Los_Angeles').toISOString()).toBe(
      '2026-11-23T08:00:00.000Z'
    );
  });

  it('on a Monday morning before the zone midnight crossing, uses the same day', () => {
    expect(weekStart(new Date('2026-11-23T07:00:00Z'), 'America/Chicago').toISOString()).toBe(
      '2026-11-23T06:00:00.000Z'
    );
    // 05:00Z Monday is still Sunday night in Dallas, so the week began the Monday before.
    expect(weekStart(new Date('2026-11-23T05:00:00Z'), 'America/Chicago').toISOString()).toBe(
      '2026-11-16T06:00:00.000Z'
    );
  });

  it('handles a daylight-saving change inside the week', () => {
    // US DST ended 2026-11-01 (Sunday). Week of Monday 2026-10-26 was CDT (UTC-5) at its start.
    expect(weekStart(new Date('2026-11-02T12:00:00Z'), 'America/Chicago').toISOString()).toBe(
      '2026-11-02T06:00:00.000Z'
    );
    expect(weekStart(new Date('2026-11-01T12:00:00Z'), 'America/Chicago').toISOString()).toBe(
      '2026-10-26T05:00:00.000Z'
    );
  });
});

describe('monthStart', () => {
  it('returns the 1st at 00:00 local time', async () => {
    const { monthStart } = await import('@/server/shop/money');
    expect(monthStart(new Date('2026-11-25T18:00:00Z'), 'America/Chicago').toISOString()).toBe(
      '2026-11-01T05:00:00.000Z' // November 1 is still CDT until 02:00, so 00:00 CDT is 05:00Z
    );
    expect(monthStart(new Date('2026-12-01T03:00:00Z'), 'America/Chicago').toISOString()).toBe(
      '2026-11-01T05:00:00.000Z' // 03:00Z on Dec 1 is still November 30 in Dallas
    );
  });
});
