import { describe, expect, it } from 'vitest';
import {
  callsHref,
  formatDuration,
  OUTCOME_META,
  rangeLabel
} from '../../src/app/dashboard/calls/format';
import { CALL_OUTCOMES } from '../../src/server/calls/outcomes';

describe('F-26: calls list presentation', () => {
  it('gives every outcome a label and the design-system tone', () => {
    for (const o of CALL_OUTCOMES) expect(OUTCOME_META[o].label).toBeTruthy();
    expect(OUTCOME_META.booked.tone).toBe('success');
    expect(OUTCOME_META.dnc.tone).toBe('error');
    expect(OUTCOME_META.qualified.tone).toBe('info');
    expect(OUTCOME_META.voicemail.tone).toBe('neutral');
  });
  it('formats durations', () => {
    expect(formatDuration(null)).toBe('–');
    expect(formatDuration(84)).toBe('1:24');
    expect(formatDuration(5)).toBe('0:05');
    expect(formatDuration(3725)).toBe('1:02:05');
  });
  it('keeps filter state in the URL', () => {
    expect(callsHref({})).toBe('/dashboard/calls');
    expect(callsHref({ outcome: 'booked', from: '2026-10-01', page: 2, pageSize: 50 })).toBe(
      '/dashboard/calls?outcome=booked&from=2026-10-01&pageSize=50&page=2'
    );
    expect(callsHref({ page: 1, pageSize: 20 })).toBe('/dashboard/calls');
  });
  it('labels the range', () => {
    expect(rangeLabel(1, 20, 0)).toBe('0 of 0');
    expect(rangeLabel(2, 20, 45)).toBe('21-40 of 45');
    expect(rangeLabel(3, 20, 45)).toBe('41-45 of 45');
  });
});
