import { describe, expect, it } from 'vitest';
import { checkWindow, intersect, isValidTimeZone } from '@/server/consent/quiet-hours';

const LA = 'America/Los_Angeles';

describe('checkWindow (08:00 to 21:00 lead-local)', () => {
  const cases: Array<[string, string, string, string | null]> = [
    // name, now (UTC), zone, next open (UTC) or null when open
    ['midday is open', '2026-10-26T18:00:00Z', LA, null],
    ['08:00 sharp is open', '2026-10-26T15:00:00Z', LA, null],
    ['20:59 is open', '2026-10-27T03:59:00Z', LA, null],
    [
      '21:00 sharp is closed until tomorrow 08:00',
      '2026-10-27T04:00:00Z',
      LA,
      '2026-10-27T15:00:00Z'
    ],
    ['22:00 waits for tomorrow 08:00', '2026-10-27T05:00:00Z', LA, '2026-10-27T15:00:00Z'],
    ['06:00 waits for 08:00 the same day', '2026-10-26T13:00:00Z', LA, '2026-10-26T15:00:00Z'],
    [
      'evening before the fall-back change opens at 08:00 PST',
      '2026-11-01T05:00:00Z',
      LA,
      '2026-11-01T16:00:00Z'
    ],
    [
      'east coast is judged in its own zone',
      '2026-10-26T11:30:00Z',
      'America/New_York',
      '2026-10-26T12:00:00Z'
    ],
    ['a zone ahead of UTC', '2026-10-26T20:30:00Z', 'Asia/Kolkata', '2026-10-27T02:30:00Z']
  ];

  it.each(cases)('%s', (_name, now, tz, nextOpen) => {
    const r = checkWindow(new Date(now), tz);
    if (nextOpen === null) expect(r).toEqual({ open: true });
    else expect(r).toEqual({ open: false, nextOpen: new Date(nextOpen) });
  });

  it('a stricter state window wins over the default', () => {
    const w = intersect(
      { startMinute: 480, endMinute: 1260 },
      { startMinute: 540, endMinute: 1200 }
    );
    expect(w).toEqual({ startMinute: 540, endMinute: 1200 });
    expect(checkWindow(new Date('2026-10-26T15:30:00Z'), LA, w)).toEqual({
      open: false,
      nextOpen: new Date('2026-10-26T16:00:00Z')
    });
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects junk', () => {
    expect(isValidTimeZone(LA)).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});
