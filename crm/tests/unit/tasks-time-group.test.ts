import { describe, expect, it } from 'vitest';
import { groupTasks, type TaskRow } from '@/server/tasks';
import { instantToLocal, localToInstant } from '@/server/tasks/time';

const row = (id: string, dueAt: string | null) => ({ id, dueAt }) as unknown as TaskRow;

describe('F-20 task time zones', () => {
  it('reads a typed local time in the tenant zone (PDT and PST)', () => {
    expect(localToInstant('2026-10-27T09:30', 'America/Los_Angeles')?.toISOString()).toBe(
      '2026-10-27T16:30:00.000Z'
    );
    expect(localToInstant('2026-12-01T09:30', 'America/Los_Angeles')?.toISOString()).toBe(
      '2026-12-01T17:30:00.000Z'
    );
  });
  it('round-trips through the zone', () => {
    const d = localToInstant('2026-03-08T12:00', 'America/Los_Angeles')!;
    expect(instantToLocal(d.toISOString(), 'America/Los_Angeles')).toBe('2026-03-08T12:00');
  });
  it('rejects malformed input', () => {
    expect(localToInstant('tomorrow', 'UTC')).toBeNull();
  });
});

describe('F-20 My Tasks grouping', () => {
  const at = new Date('2026-10-27T18:00:00Z');
  const tomorrow = new Date('2026-10-28T07:00:00Z');
  it('puts past-due (even earlier today) under Overdue, then Today, then Upcoming with undated last', () => {
    const g = groupTasks(
      [
        row('undated', null),
        row('later', '2026-10-30T20:00:00Z'),
        row('tonight', '2026-10-28T06:59:00Z'),
        row('earlier-today', '2026-10-27T15:00:00Z'),
        row('yesterday', '2026-10-26T20:00:00Z'),
        row('tomorrow-start', '2026-10-28T07:00:00Z')
      ],
      at,
      tomorrow
    );
    expect(g.overdue.map((t) => t.id)).toEqual(['yesterday', 'earlier-today']);
    expect(g.today.map((t) => t.id)).toEqual(['tonight']);
    expect(g.upcoming.map((t) => t.id)).toEqual(['tomorrow-start', 'later', 'undated']);
  });
});
