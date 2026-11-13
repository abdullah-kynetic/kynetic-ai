import { describe, expect, it } from 'vitest';
import {
  customErrorsByKey,
  customFieldMessage,
  customFromDrafts,
  draftsFromValues,
  valueFromDraft
} from '@/features/custom-fields/inputs';
import type { CustomFieldDef } from '@/server/custom-fields/types';

const def = (
  key: string,
  type: CustomFieldDef['type'],
  options: string[] = []
): CustomFieldDef => ({
  id: key,
  entity: 'contact',
  key,
  label: key,
  type,
  options,
  showInTable: false,
  filterable: false,
  importable: true,
  position: 0
});

describe('F-12 custom field form drafts', () => {
  const defs = [
    def('note', 'text'),
    def('crew', 'number'),
    def('budget', 'money'),
    def('when', 'date'),
    def('roof', 'select', ['Tile']),
    def('extras', 'multi_select', ['A', 'B']),
    def('ok', 'checkbox')
  ];

  it('turns stored values into drafts and back', () => {
    const stored = {
      note: 'hi',
      crew: 6,
      budget: 125050,
      when: '2026-12-01',
      roof: 'Tile',
      extras: ['A'],
      ok: true
    };
    const drafts = draftsFromValues(defs, stored);
    expect(drafts).toMatchObject({ budget: '1250.50', crew: '6', extras: ['A'], ok: true });
    expect(customFromDrafts(defs, drafts)).toEqual(stored);
  });

  it('leaves out blank text, an empty list and an unticked box', () => {
    expect(customFromDrafts(defs, draftsFromValues(defs, {}))).toEqual({});
  });

  it('parses dollars to cents and numbers, and passes bad text on for the server to refuse', () => {
    expect(valueFromDraft(def('m', 'money'), '$12,500')).toBe(1250000);
    expect(valueFromDraft(def('m', 'money'), '12.345')).toBe('12.345');
    expect(valueFromDraft(def('n', 'number'), '2.5')).toBe(2.5);
    expect(valueFromDraft(def('n', 'number'), 'six')).toBe('six');
  });

  it('keeps only the custom.<key> server errors, by key, with a sentence per type', () => {
    expect(customErrorsByKey({ name: ['x'], 'custom.budget': ['invalid_type'] })).toEqual({
      budget: ['invalid_type']
    });
    expect(customFieldMessage(def('m', 'money'), ['whatever'])).toMatch(/amount/);
    expect(customFieldMessage(def('r', 'select'), ['not_an_option'])).toMatch(/listed/);
  });
});
