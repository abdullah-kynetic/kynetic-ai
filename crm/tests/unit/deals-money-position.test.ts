import { describe, expect, it } from 'vitest';
import { formatCents, parseMoneyToCents } from '@/server/deals/money';
import { positionBetween } from '@/server/deals/position';

describe('M2-01 deal money (F-14)', () => {
  it('stores $12,500 as 1250000 cents and shows it as $12,500', () => {
    expect(parseMoneyToCents('$12,500')).toBe(1_250_000);
    expect(formatCents(1_250_000)).toBe('$12,500');
  });
  it('handles cents and plain numbers', () => {
    expect(parseMoneyToCents('12,500.5')).toBe(1_250_050);
    expect(parseMoneyToCents(99)).toBe(9_900);
    expect(formatCents(1_250_050)).toBe('$12,500.50');
    expect(formatCents(0)).toBe('$0');
  });
  it('refuses negatives, letters, extra decimals and over the column ceiling', () => {
    for (const bad of ['-5', 'abc', '1.234', '', '99999999999']) {
      expect(parseMoneyToCents(bad)).toBeNull();
    }
  });
});

describe('M2-01 position keys (F-16)', () => {
  it('orders the first, last and middle placements', () => {
    const first = positionBetween(null, null);
    const after = positionBetween(first, null);
    const before = positionBetween(null, first);
    const middle = positionBetween(first, after);
    expect(before < first && first < middle && middle < after).toBe(true);
  });
  it('keeps room after many inserts at the same spot', () => {
    let lo = positionBetween(null, null);
    const hi = positionBetween(lo, null);
    for (let i = 0; i < 200; i++) {
      const mid = positionBetween(lo, hi);
      expect(mid > lo && mid < hi).toBe(true);
      lo = mid;
    }
  });
  it('can insert before the first key repeatedly', () => {
    let first = positionBetween(null, null);
    for (let i = 0; i < 100; i++) {
      const k = positionBetween(null, first);
      expect(k < first).toBe(true);
      first = k;
    }
  });
  it('works against the seed-style keys', () => {
    const k = positionBetween('a000', 'a001');
    expect(k > 'a000' && k < 'a001').toBe(true);
  });
  it('throws when the keys are out of order', () => {
    expect(() => positionBetween('b', 'a')).toThrow();
  });
});
