import { describe, expect, test } from 'vitest';
import { guaranteeProgress } from '../../src/server/metrics';
import fixture from '../fixtures/metrics-dashboard.json';

describe('M6 dashboard metric fixture', () => {
  test('computes the 30-day 20 percent guarantee', () => {
    expect(
      guaranteeProgress({
        baseline: 10,
        startDate: '2026-01-01',
        booked: 6,
        today: new Date('2026-01-16T00:00:00Z')
      })
    ).toEqual({ baseline: 10, target: 12, booked: 6, percent: 50, daysLeft: 15, windowDays: 30 });
  });

  test('caps completed guarantees and hides incomplete configuration', () => {
    expect(
      guaranteeProgress({
        baseline: 10,
        startDate: '2026-01-01',
        booked: 30,
        today: new Date('2026-04-01T00:00:00Z')
      })
    ).toMatchObject({ percent: 100, daysLeft: 0 });
    expect(
      guaranteeProgress({
        baseline: null,
        startDate: null,
        booked: 2,
        today: new Date('2026-01-01T00:00:00Z')
      })
    ).toBeNull();
  });

  test('matches the hand-computed dashboard fixture', () => {
    const totals = fixture.days.reduce(
      (out, day) => ({
        leads: out.leads + day.leads,
        calls: out.calls + day.calls,
        contactsReached: out.contactsReached + day.contactsReached,
        estimatesBooked: out.estimatesBooked + day.estimatesBooked,
        wonRevenueCents: out.wonRevenueCents + day.wonRevenueCents
      }),
      { leads: 0, calls: 0, contactsReached: 0, estimatesBooked: 0, wonRevenueCents: 0 }
    );
    expect(totals).toEqual(fixture.expected);
  });
});
