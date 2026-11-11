import { describe, expect, it } from 'vitest';
import { dailyRateSeries, pacificDay, seriesDays } from '@/server/agency/rates';

// 2026-11-10T12:00:00Z is 04:00 Pacific on 2026-11-10.
const now = new Date('2026-11-10T12:00:00Z');

describe('agency rate series', () => {
  it('formats dates as Pacific day keys', () => {
    expect(pacificDay('2026-11-10T12:00:00Z')).toBe('2026-11-10');
    // 2026-11-10T07:00:00Z is still 2026-11-09 in Pacific (23:00 the day before).
    expect(pacificDay('2026-11-10T07:00:00Z')).toBe('2026-11-09');
  });

  it('returns the requested day count oldest first, ending today', () => {
    const days = seriesDays(30, now);
    expect(days).toHaveLength(30);
    expect(days[0]).toBe('2026-10-12');
    expect(days[29]).toBe('2026-11-10');
  });

  it('reports null, not zero, for days without attempts or outreach', () => {
    const points = dailyRateSeries([], [], 30, now);
    expect(points).toHaveLength(30);
    expect(points.every((p) => p.pickRate === null && p.replyRate === null)).toBe(true);
  });

  it('buckets attempts and replies into their Pacific day', () => {
    const outcomes = [
      { outcome: 'connected', at: '2026-11-10T18:00:00Z' },
      { outcome: 'no_answer', at: '2026-11-10T19:00:00Z' },
      { outcome: 'voicemail', at: '2026-10-20T20:00:00Z' }
    ];
    const messages = [
      { contactId: 'a', direction: 'outbound', at: '2026-11-09T20:00:00Z' },
      { contactId: 'a', direction: 'inbound', at: '2026-11-09T21:00:00Z' },
      { contactId: 'b', direction: 'inbound', at: '2026-11-09T22:00:00Z' }
    ];
    const points = dailyRateSeries(outcomes, messages, 30, now);
    const byDay = new Map(points.map((p) => [p.day, p]));
    expect(byDay.get('2026-11-10')).toMatchObject({ pickRate: 0.5, replyRate: null });
    // Prospect b replied with no prior outbound, so only prospect a counts as replied.
    expect(byDay.get('2026-11-09')).toMatchObject({ pickRate: null, replyRate: 1 });
    expect(byDay.get('2026-10-20')).toMatchObject({ pickRate: 0, replyRate: null });
    expect(points[0].day).toBe('2026-10-12');
    expect(points[29].day).toBe('2026-11-10');
  });
});
