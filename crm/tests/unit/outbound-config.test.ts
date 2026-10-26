import { describe, expect, it } from 'vitest';
import { DEFAULT_WINDOW } from '@/server/consent';
import {
  DEFAULT_RETRY_DELAYS_MIN,
  parseCallWindow,
  parseRetryDelays
} from '@/server/calls/outbound-config';

describe('parseCallWindow (F-78)', () => {
  it('narrows the compliance window', () => {
    expect(parseCallWindow({ start: '09:00', end: '17:30' })).toEqual({
      startMinute: 540,
      endMinute: 1050
    });
  });
  it('never widens it', () => {
    expect(parseCallWindow({ start: '05:00', end: '23:30' })).toEqual(DEFAULT_WINDOW);
  });
  it.each([
    {},
    null,
    'x',
    { start: '9am', end: '5pm' },
    { start: '10:00', end: '09:00' },
    { start: '22:00', end: '23:00' }
  ])('falls back to the compliance window for %j', (raw) => {
    expect(parseCallWindow(raw)).toEqual(DEFAULT_WINDOW);
  });
});

describe('parseRetryDelays (F-78)', () => {
  it('reads the configured cadence', () => {
    expect(parseRetryDelays({ delaysMinutes: [2, 30, 240] })).toEqual([2, 30, 240]);
  });
  it('an empty list means no retries', () => {
    expect(parseRetryDelays({ delaysMinutes: [] })).toEqual([]);
  });
  it.each([
    {},
    null,
    { delaysMinutes: [0] },
    { delaysMinutes: [1.5] },
    { delaysMinutes: [2000] },
    { delaysMinutes: [1, 1, 1, 1, 1, 1] }
  ])('uses the default for %j', (raw) => {
    expect(parseRetryDelays(raw)).toEqual(DEFAULT_RETRY_DELAYS_MIN);
  });
});
