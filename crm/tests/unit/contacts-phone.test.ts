import { describe, expect, it } from 'vitest';
import { normalizePhone, normalizePhones } from '@/server/contacts/phone';

describe('F-07: phone normalisation to E.164', () => {
  it.each([
    ['(415) 555-0100', '+14155550100'],
    ['415-555-0100', '+14155550100'],
    ['1 415 555 0100', '+14155550100'],
    ['+1 (415) 555-0100', '+14155550100'],
    ['415.555.0100 x23', '+14155550100'],
    ['+44 7911 123456', '+447911123456'],
    ['0044 7911 123456', '+447911123456']
  ])('%s -> %s', (raw, want) => expect(normalizePhone(raw)).toBe(want));

  it.each([
    '',
    'abc',
    '555-0100',
    '(015) 555-0100',
    '1415555',
    '+0123456789',
    '415-555-0100 call me'
  ])('rejects %j', (raw) => expect(normalizePhone(raw)).toBeNull());

  it('dedupes, drops blanks and separates invalid entries', () => {
    expect(normalizePhones(['415-555-0100', '(415) 555 0100', ' ', 'nope'])).toEqual({
      valid: ['+14155550100'],
      invalid: ['nope']
    });
  });
});
