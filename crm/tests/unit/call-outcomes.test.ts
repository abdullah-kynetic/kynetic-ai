import { describe, expect, it } from 'vitest';
import { normalizeOutcome, normalizeSentiment } from '@/server/calls/outcomes';

describe('call outcome mapping', () => {
  it.each([
    ['booked', 'booked'],
    ['Not Interested', 'not_interested'],
    ['no-answer', 'no_answer'],
    ['failed:busy', 'no_answer'],
    ['failed:invalid_number', 'other'],
    ['success', 'other'],
    ['', 'other'],
    [undefined, 'other']
  ])('%s becomes %s', (raw, expected) => {
    expect(normalizeOutcome(raw)).toBe(expected);
  });

  it('keeps known sentiments, flags unknown wording, and leaves absent as null', () => {
    expect(normalizeSentiment('Positive')).toBe('positive');
    expect(normalizeSentiment('thrilled')).toBe('unknown');
    expect(normalizeSentiment(undefined)).toBeNull();
  });
});
