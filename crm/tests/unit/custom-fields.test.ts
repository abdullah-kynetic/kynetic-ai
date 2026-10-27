import { describe, expect, it } from 'vitest';
import { createFieldDefSchema, updateFieldDefSchema } from '@/server/custom-fields/schemas';
import { checkCustomFilters } from '@/server/custom-fields/filters';
import {
  checkCustomValues,
  formatCustomValue,
  type CustomFieldDef
} from '@/server/custom-fields/types';
import { readListView } from '@/features/contacts/list/search-params';

const def = (
  over: Partial<CustomFieldDef> & Pick<CustomFieldDef, 'key' | 'type'>
): CustomFieldDef => ({
  id: crypto.randomUUID(),
  entity: 'contact',
  label: over.key,
  options: [],
  showInTable: false,
  filterable: true,
  importable: true,
  position: 0,
  ...over
});

const DEFS = [
  def({ key: 'notes_text', type: 'text' }),
  def({ key: 'roof_age', type: 'number' }),
  def({ key: 'budget', type: 'money' }),
  def({ key: 'inspect_on', type: 'date' }),
  def({ key: 'roof_type', type: 'select', options: ['Tile', 'Shingle'] }),
  def({ key: 'extras', type: 'multi_select', options: ['Gutters', 'Solar', 'Skylight'] }),
  def({ key: 'insured', type: 'checkbox' })
];

describe('M1-06 custom field values (F-12)', () => {
  it('accepts a valid value of every type and drops empty ones', () => {
    const r = checkCustomValues(DEFS, {
      notes_text: ' hello ',
      roof_age: 12.5,
      budget: 450000,
      inspect_on: '2026-10-26',
      roof_type: 'Tile',
      extras: ['Gutters', 'Solar'],
      insured: false
    });
    expect(r).toEqual({
      ok: true,
      values: {
        notes_text: 'hello',
        roof_age: 12.5,
        budget: 450000,
        inspect_on: '2026-10-26',
        roof_type: 'Tile',
        extras: ['Gutters', 'Solar'],
        insured: false
      }
    });
    expect(checkCustomValues(DEFS, { roof_type: null, extras: [], notes_text: '' })).toEqual({
      ok: true,
      values: {}
    });
  });

  it.each([
    ['notes_text', 5],
    ['notes_text', 'x'.repeat(2001)],
    ['roof_age', '12'],
    ['roof_age', Number.POSITIVE_INFINITY],
    ['budget', 12.5],
    ['inspect_on', '26/10/2026'],
    ['inspect_on', '2026-02-31'],
    ['roof_type', 'Slate'],
    ['extras', ['Solar', 'Solar']],
    ['extras', ['Pool']],
    ['extras', 'Solar'],
    ['insured', 'yes']
  ])('rejects %s = %j', (key, value) => {
    const r = checkCustomValues(DEFS, { [key]: value });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors)).toEqual([`custom.${key}`]);
  });

  it('rejects unknown keys so custom cannot become free storage', () => {
    const r = checkCustomValues(DEFS, { surprise: 'x' });
    expect(r).toEqual({ ok: false, errors: { 'custom.surprise': ['unknown_field'] } });
  });

  it('formats values for display', () => {
    const f = (type: CustomFieldDef['type'], v: unknown) => formatCustomValue({ type }, v);
    expect(f('money', 450050)).toBe('$4,500.50');
    expect(f('number', 1234.5)).toBe('1,234.5');
    expect(f('date', '2026-10-26')).toBe('Oct 26, 2026');
    expect(f('checkbox', true)).toBe('Yes');
    expect(f('checkbox', false)).toBe('No');
    expect(f('multi_select', ['A', 'B'])).toBe('A, B');
    expect(f('select', undefined)).toBe('');
  });
});

describe('M1-06 definition input', () => {
  const base = { entity: 'contact', key: 'roof_type', label: 'Roof type' } as const;
  it('needs options for a select and refuses them elsewhere', () => {
    expect(createFieldDefSchema.safeParse({ ...base, type: 'select' }).success).toBe(false);
    expect(
      createFieldDefSchema.safeParse({ ...base, type: 'select', options: ['Tile', 'Tile'] }).success
    ).toBe(false);
    expect(
      createFieldDefSchema.safeParse({ ...base, type: 'select', options: ['Tile'] }).success
    ).toBe(true);
    expect(createFieldDefSchema.safeParse({ ...base, type: 'text', options: ['x'] }).success).toBe(
      false
    );
  });
  it('rejects bad keys, entities and extra properties', () => {
    for (const key of ['Roof', '1abc', 'a', 'has space', 'x'.repeat(42)]) {
      expect(createFieldDefSchema.safeParse({ ...base, key, type: 'text' }).success).toBe(false);
    }
    expect(createFieldDefSchema.safeParse({ ...base, entity: 'user', type: 'text' }).success).toBe(
      false
    );
    expect(createFieldDefSchema.safeParse({ ...base, type: 'text', tenantId: 'x' }).success).toBe(
      false
    );
  });
  it('does not let an update change key, type or entity', () => {
    expect(updateFieldDefSchema.safeParse({ type: 'number' }).success).toBe(false);
    expect(updateFieldDefSchema.safeParse({ key: 'other' }).success).toBe(false);
    expect(updateFieldDefSchema.safeParse({ label: 'New' }).success).toBe(true);
  });
});

describe('M1-06 custom filters', () => {
  it('pairs each filter with its field and rejects mismatches', () => {
    expect(checkCustomFilters(DEFS, { roof_type: { any: ['Tile'] } })).toHaveLength(1);
    expect(() => checkCustomFilters(DEFS, { roof_type: { contains: 'x' } })).toThrow();
    expect(() => checkCustomFilters(DEFS, { nope: { any: ['x'] } })).toThrow();
    expect(() =>
      checkCustomFilters([def({ key: 'hidden_one', type: 'text', filterable: false })], {
        hidden_one: { contains: 'x' }
      })
    ).toThrow();
  });
});

describe('M1-06 custom filters in the leads list URL', () => {
  it('reads cf_ params by field type, and ignores them without definitions', () => {
    const params = {
      cf_roof_type: 'Tile,Slate',
      cf_insured: 'true',
      cf_notes_text: 'leak',
      cf_roof_age: '12',
      cf_budget: '4500.50',
      cf_inspect_on: '2026-10-01,2026-10-31'
    };
    expect(readListView(params).custom).toBeUndefined();
    expect(readListView(params, DEFS).custom).toEqual({
      roof_type: { any: ['Tile'] },
      insured: { any: ['true'] },
      notes_text: { contains: 'leak' },
      roof_age: { eq: 12 },
      budget: { eq: 450050 },
      inspect_on: { from: '2026-10-01', to: '2026-10-31' }
    });
  });
  it('falls back instead of failing on junk', () => {
    const v = readListView(
      { cf_roof_age: 'abc', cf_inspect_on: 'soon', cf_roof_type: 'Slate' },
      DEFS
    );
    expect(v.custom).toBeUndefined();
  });
  it('keeps custom column ids in hide, and drops made-up ones', () => {
    expect(readListView({ hide: 'cf_roof_type,email,bogus,cf_' }).hidden).toEqual([
      'cf_roof_type',
      'email'
    ]);
  });
});
