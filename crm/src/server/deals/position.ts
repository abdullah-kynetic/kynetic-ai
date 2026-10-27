// Fractional position keys for kanban order (F-16, DATABASE deals.position). A key is a string over
// 0-9a-z, so plain text comparison orders it the same under every collation. Moving a card writes
// one row: its new key falls between its neighbours' keys. Keys never end in the zero digit.

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const BASE = DIGITS.length;

const digit = (c: string | undefined): number => (c === undefined ? 0 : DIGITS.indexOf(c));

function midpoint(a: string, b: string | null): string {
  if (b !== null && a >= b) throw new Error('position keys out of order');
  if (b !== null) {
    let n = 0;
    while ((a[n] ?? '0') === b[n]) n++;
    if (n > 0) return b.slice(0, n) + midpoint(a.slice(n), b.slice(n));
  }
  const da = a ? digit(a[0]) : 0;
  const db = b !== null ? digit(b[0]) : BASE;
  if (da < 0 || db < 0) throw new Error('invalid position key');
  if (db - da > 1) return DIGITS[Math.round((da + db) / 2)]!;
  if (b !== null && b.length > 1) return b.slice(0, 1);
  return DIGITS[da]! + midpoint(a.slice(1), null);
}

/** A key strictly between `before` and `after`; null means the start or end of the column. */
export function positionBetween(before: string | null, after: string | null): string {
  return midpoint(before ?? '', after);
}
