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

describe('checkWindow across daylight-saving changes', () => {
  const SYD = 'Australia/Sydney';
  const cases: Array<[string, string, string, string | null]> = [
    // spring forward, Sun 2026-03-08 in Los Angeles (02:00 PST becomes 03:00 PDT)
    [
      'evening before spring forward waits for 08:00 PDT',
      '2026-03-08T05:00:00Z',
      LA,
      '2026-03-08T15:00:00Z'
    ],
    ['07:59 PDT on the change day is closed', '2026-03-08T14:59:00Z', LA, '2026-03-08T15:00:00Z'],
    ['08:00 PDT on the change day is open', '2026-03-08T15:00:00Z', LA, null],
    [
      '21:00 PDT on the change day closes until the next 08:00',
      '2026-03-09T04:00:00Z',
      LA,
      '2026-03-09T15:00:00Z'
    ],
    // fall back, Sun 2026-11-01 (02:00 PDT becomes 01:00 PST)
    ['20:59 PDT the evening before fall back is open', '2026-11-01T03:59:00Z', LA, null],
    [
      '21:00 PDT the evening before fall back opens at 08:00 PST',
      '2026-11-01T04:00:00Z',
      LA,
      '2026-11-01T16:00:00Z'
    ],
    ['07:59 PST on the change day is closed', '2026-11-01T15:59:00Z', LA, '2026-11-01T16:00:00Z'],
    ['08:00 PST on the change day is open', '2026-11-01T16:00:00Z', LA, null],
    [
      'the hour after the change is 07:00 PST, still closed',
      '2026-11-01T15:00:00Z',
      LA,
      '2026-11-01T16:00:00Z'
    ],
    // the day after, offsets are settled
    ['08:00 PST the next day is open', '2026-11-02T16:00:00Z', LA, null],
    // southern hemisphere: Sydney springs forward Sun 2026-10-04
    [
      'Sydney evening before spring forward opens at 08:00 AEDT',
      '2026-10-03T11:00:00Z',
      SYD,
      '2026-10-03T21:00:00Z'
    ],
    ['Sydney 08:00 AEDT on the change day is open', '2026-10-03T21:00:00Z', SYD, null],
    // no DST at all
    ['Phoenix is never shifted', '2026-07-01T14:59:00Z', 'America/Phoenix', '2026-07-01T15:00:00Z']
  ];

  it.each(cases)('%s', (_name, now, tz, nextOpen) => {
    const r = checkWindow(new Date(now), tz);
    if (nextOpen === null) expect(r).toEqual({ open: true });
    else expect(r).toEqual({ open: false, nextOpen: new Date(nextOpen) });
  });

  it('a window start inside the skipped hour opens at the instant it would have', () => {
    // 02:30 does not exist on 2026-03-08 in Los Angeles; 02:30 PST and 03:30 PDT are the same instant.
    const r = checkWindow(new Date('2026-03-08T09:00:00Z'), LA, {
      startMinute: 150,
      endMinute: 1260
    });
    expect(r).toEqual({ open: false, nextOpen: new Date('2026-03-08T10:30:00Z') });
  });
});

describe('isValidTimeZone', () => {
  it('accepts IANA zones and rejects junk', () => {
    expect(isValidTimeZone(LA)).toBe(true);
    expect(isValidTimeZone('Mars/Olympus')).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
  });
});
