import { describe, expect, it } from 'vitest';
import {
  canDryRun,
  guessMapping,
  importErrorMessage,
  mappingPayload
} from '@/features/imports/mapping';

describe('P1-5 client import column matching', () => {
  it('guesses columns from common header spellings and never uses one header twice', () => {
    expect(
      guessMapping(['First Name', 'Last name', 'Mobile Phone', 'E-mail', 'Notes', 'ID'])
    ).toEqual({
      firstName: 'First Name',
      lastName: 'Last name',
      phone: 'Mobile Phone',
      email: 'E-mail',
      externalId: 'ID'
    });
    expect(guessMapping(['name', 'when'])).toEqual({});
  });

  it('needs a phone or an email before a dry run, and sends only mapped fields', () => {
    expect(canDryRun({ firstName: 'a' })).toBe(false);
    expect(canDryRun({ email: 'e' })).toBe(true);
    expect(mappingPayload({ phone: 'p', email: undefined, lastName: '' })).toEqual({ phone: 'p' });
  });

  it('turns server reasons into plain sentences', () => {
    expect(importErrorMessage({ error: { fieldErrors: { file: ['too_large'] } } })).toMatch(
      /10 MB/
    );
    expect(importErrorMessage({ error: { fieldErrors: { file: ['macros'] } } })).toMatch(
      /could not be read/
    );
    expect(importErrorMessage({ error: { message: 'Too many requests.' } })).toBe(
      'Too many requests.'
    );
  });
});
