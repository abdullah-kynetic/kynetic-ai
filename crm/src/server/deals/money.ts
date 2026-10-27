// Money is stored as integer cents (F-14: $12,500 is 1250000). Parsing is for form input; the
// database column is `deals.value_cents integer`, so the ceiling is 2^31 - 1 cents.

export const MAX_VALUE_CENTS = 2_147_483_647;

/**
 * Parses what a person types into cents: `12500`, `12,500`, `$12,500.50`, `12.5`. Returns null for
 * anything else (letters, negatives, more than two decimals, over the column ceiling).
 */
export function parseMoneyToCents(input: string | number): number | null {
  const text = String(input).trim().replace(/^\$/, '').replace(/,/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) return null;
  const [whole, frac = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents <= MAX_VALUE_CENTS ? cents : null;
}

/** `1250000` becomes `$12,500`; amounts with cents keep both decimals (`$12,500.50`). */
export function formatCents(cents: number): string {
  const whole = cents % 100 === 0;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2
  }).format(cents / 100);
}
