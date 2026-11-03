import { describe, expect, it } from 'vitest';
import {
  cleanDisclosure,
  contactState,
  disclosureHeard,
  disclosureVersion,
  isTwoPartyState,
  STATE_RULES
} from '@/server/compliance';

describe('contactState', () => {
  it.each([
    [{ state: 'CA' }, 'CA'],
    [{ state: ' fl ' }, 'FL'],
    [{ state: 'California' }, null],
    [{ state: 7 }, null],
    [{}, null],
    [null, null]
  ])('%j -> %s', (address, expected) => {
    expect(contactState(address)).toBe(expected);
  });
});

describe('state rules', () => {
  it('flags the listed two-party states and not others', () => {
    expect(isTwoPartyState('CA')).toBe(true);
    expect(isTwoPartyState('TX')).toBe(false);
    expect(isTwoPartyState(null)).toBe(false);
    expect(isTwoPartyState('TX', { ...STATE_RULES, twoPartyRecordingStates: ['TX'] })).toBe(true);
  });

  it('only ever narrows the 08:00 to 21:00 default, and is marked as not reviewed', () => {
    expect(STATE_RULES.reviewedByCounsel).toBe(false);
    for (const w of Object.values(STATE_RULES.quietWindows)) {
      expect(w.startMinute).toBeGreaterThanOrEqual(8 * 60);
      expect(w.endMinute).toBeLessThanOrEqual(21 * 60);
    }
  });
});

describe('disclosure', () => {
  const text = 'This call may be recorded.';

  it('treats blank text as none', () => {
    expect(cleanDisclosure('  ')).toBeNull();
    expect(cleanDisclosure(null)).toBeNull();
    expect(cleanDisclosure(` ${text} `)).toBe(text);
  });

  it('versions the words, not the formatting', () => {
    expect(disclosureVersion(text)).toBe(disclosureVersion('this  CALL may be recorded'));
    expect(disclosureVersion(text)).not.toBe(disclosureVersion('This call is recorded.'));
  });

  it('hears the disclosure ignoring case and punctuation, but not a partial one', () => {
    expect(disclosureHeard('Alex: Hi! this call, may be RECORDED. Ok?', text)).toBe(true);
    expect(disclosureHeard('Alex: this call may be', text)).toBe(false);
    expect(disclosureHeard('anything', '  ')).toBe(false);
  });
});
