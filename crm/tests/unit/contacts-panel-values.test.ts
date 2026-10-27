import { describe, expect, it } from 'vitest';
import {
  emptyPanelValues,
  splitLines,
  toContactInput,
  valuesFromContact
} from '@/features/contacts/panel/values';

describe('F-07: contact panel form values', () => {
  it('splits phones and emails by line, comma or semicolon and drops blanks', () => {
    expect(splitLines('415-555-0111\n\n 415-555-0112 ,; ')).toEqual([
      '415-555-0111',
      '415-555-0112'
    ]);
  });

  it('F-07: empty text becomes null, never an empty string', () => {
    const input = toContactInput({
      ...emptyPanelValues,
      firstName: ' Ana ',
      phones: '415-555-0111'
    });
    expect(input).toMatchObject({
      firstName: 'Ana',
      lastName: null,
      source: null,
      ownerId: null,
      phones: ['415-555-0111'],
      emails: [],
      status: 'new'
    });
  });

  it('F-07: editing round-trips a contact through the form', () => {
    const v = valuesFromContact({
      firstName: 'Ana',
      lastName: null,
      phones: ['+14155550111', '+14155550112'],
      emails: ['ana@example.test'],
      status: 'working',
      source: 'angi',
      ownerId: null,
      tags: ['vip']
    });
    expect(v.phones).toBe('+14155550111\n+14155550112');
    expect(toContactInput(v)).toMatchObject({
      phones: ['+14155550111', '+14155550112'],
      emails: ['ana@example.test'],
      source: 'angi',
      tags: ['vip']
    });
  });
});
