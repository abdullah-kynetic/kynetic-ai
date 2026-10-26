// Phone normalisation for contacts (M1-01, DC-070). Numbers are stored as E.164. v1 clients are US
// businesses, so a number without a country code is read as US/Canada (+1). No external library: the
// rule is small and the DB CHECK (`^\+[1-9][0-9]{7,14}$`) is the backstop.

const E164 = /^\+[1-9][0-9]{7,14}$/;

/**
 * Returns the E.164 form of `input`, or null when it cannot be read as a phone number.
 * Accepts `(415) 555-0100`, `415-555-0100`, `1 415 555 0100`, `+14155550100`, `00447911123456`.
 * A trailing extension (`x12`, `ext. 12`) is dropped. A bare 10-digit number must have a valid
 * area code (first digit 2 to 9).
 */
export function normalizePhone(input: string): string | null {
  const text = input
    .trim()
    .replace(/\s*(?:ext\.?|extension|x|#)\s*\d{1,6}$/i, '')
    .trim();
  if (!text || /[^\d\s().+-]/.test(text)) return null;
  const digits = text.replace(/\D/g, '');

  let e164: string;
  if (text.startsWith('+')) e164 = `+${digits}`;
  else if (text.startsWith('00')) e164 = `+${digits.slice(2)}`;
  else if (digits.length === 10 && /^[2-9]/.test(digits)) e164 = `+1${digits}`;
  else if (digits.length === 11 && /^1[2-9]/.test(digits)) e164 = `+${digits}`;
  else return null;

  return E164.test(e164) ? e164 : null;
}

/** Normalises a list, dropping blanks and repeats and keeping first-seen order. Invalid entries are returned apart. */
export function normalizePhones(inputs: readonly string[]): { valid: string[]; invalid: string[] } {
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const raw of inputs) {
    if (!raw.trim()) continue;
    const n = normalizePhone(raw);
    if (n === null) invalid.push(raw);
    else if (!valid.includes(n)) valid.push(n);
  }
  return { valid, invalid };
}
