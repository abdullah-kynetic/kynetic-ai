import { describe, expect, it } from 'vitest';
import { weeklyEmailControl } from '@/server/shop/weekly-email';

describe('D-4 weekly email control', () => {
  it('is disabled unless both flags are on', () => {
    for (const [env, tenant] of [
      [false, false],
      [true, false],
      [false, true]
    ] as const) {
      const c = weeklyEmailControl(env, tenant);
      expect(c.allowed).toBe(false);
      expect(c.note).toBe('Turns on when this is connected');
    }
  });
  it('says it is on only when both flags are on', () => {
    const c = weeklyEmailControl(true, true);
    expect(c.allowed).toBe(true);
    expect(c.label).toBe('Weekly email is on');
  });
});
