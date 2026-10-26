import { describe, expect, it } from 'vitest';
import { actorLabel, relativeTime } from '@/components/timeline/format';
import { parseTimelineParams } from '@/components/timeline/params';

describe('timeline helpers', () => {
  const now = new Date('2026-10-26T12:00:00Z');
  it('formats relative time', () => {
    expect(relativeTime('2026-10-26T11:59:40Z', now)).toBe('just now');
    expect(relativeTime('2026-10-26T09:00:00Z', now)).toBe('3 hours ago');
    expect(relativeTime('2026-10-25T12:00:00Z', now)).toBe('yesterday');
  });
  it('labels machine actors distinctly', () => {
    expect(actorLabel({ type: 'alex', id: null, name: null })).toBe('Alex');
    expect(actorLabel({ type: 'automation', id: null, name: null })).toBe('Automation');
    expect(actorLabel({ type: 'user', id: 'x', name: 'Dee' })).toBe('Dee');
  });
  it('parses params and drops unknown types', () => {
    expect(parseTimelineParams({ type: ['call', 'bogus'], cursor: 'abc' })).toEqual({
      types: ['call'],
      cursor: 'abc'
    });
    expect(parseTimelineParams({ type: 'sms' }).types).toEqual(['sms']);
  });
});
