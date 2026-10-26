import { z } from 'zod';
import { FIELD_LIMITS } from '../validation';

// Custom field model (M1-06; PRD F-12; DATABASE custom_field_defs). Client-safe: no database or
// server imports, so forms and tables share the same value rules as the service (DESIGN_SYSTEM forms).

export const CUSTOM_FIELD_ENTITIES = ['contact', 'company', 'deal'] as const;
export type CustomFieldEntity = (typeof CUSTOM_FIELD_ENTITIES)[number];

export const CUSTOM_FIELD_TYPES = [
  'text',
  'number',
  'money',
  'date',
  'select',
  'multi_select',
  'checkbox'
] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  money: 'Money',
  date: 'Date',
  select: 'Select',
  multi_select: 'Multi-select',
  checkbox: 'Checkbox'
};

export const CUSTOM_FIELD_ENTITY_LABELS: Record<CustomFieldEntity, string> = {
  contact: 'Contacts',
  company: 'Companies',
  deal: 'Deals'
};

export const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]{1,40}$/;
export const MAX_FIELD_OPTIONS = 100;
export const MAX_OPTION_LENGTH = 100;
export const MAX_LABEL_LENGTH = 100;

/** One field definition as the app reads it. Options are the allowed values of a (multi-)select. */
export type CustomFieldDef = {
  id: string;
  entity: CustomFieldEntity;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  showInTable: boolean;
  filterable: boolean;
  importable: boolean;
  position: number;
};

export const isSelectType = (t: CustomFieldType) => t === 'select' || t === 'multi_select';

/** A stored value: text and select are strings, number and money (integer cents) are numbers, multi-select is a list. */
export type CustomValue = string | number | boolean | string[];

const SAFE = Number.MAX_SAFE_INTEGER;

/**
 * The Zod schema for one definition's value (SECURITY 5.1: values must match the declared type and
 * options). Money is whole cents; number may be fractional; date is a calendar day (YYYY-MM-DD).
 */
export function valueSchemaFor(def: Pick<CustomFieldDef, 'type' | 'options'>): z.ZodType<CustomValue> {
  const allowed = new Set(def.options);
  switch (def.type) {
    case 'text':
      return z.string().trim().min(1).max(FIELD_LIMITS.customText);
    case 'number':
      return z.number().finite().min(-SAFE).max(SAFE);
    case 'money':
      return z.number().int().min(-SAFE).max(SAFE);
    case 'date':
      return z.iso.date();
    case 'select':
      return z.string().refine((v) => allowed.has(v), 'not_an_option');
    case 'multi_select':
      return z
        .array(z.string().refine((v) => allowed.has(v), 'not_an_option'))
        .max(MAX_FIELD_OPTIONS)
        .refine((a) => new Set(a).size === a.length, 'duplicate');
    case 'checkbox':
      return z.boolean();
  }
}

/** Empty means "no value": null, an empty string or an empty list. These keys are dropped on save. */
export const isEmptyValue = (v: unknown) =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0);

export type CustomValueResult =
  | { ok: true; values: Record<string, CustomValue> }
  | { ok: false; errors: Record<string, string[]> };

/**
 * Checks a whole `custom` object against the definitions of one entity. Unknown keys are rejected so
 * the jsonb column cannot become free storage. Errors are keyed `custom.<key>` and carry reasons only.
 */
export function checkCustomValues(
  defs: readonly CustomFieldDef[],
  raw: Record<string, unknown>
): CustomValueResult {
  const byKey = new Map(defs.map((d) => [d.key, d]));
  const values: Record<string, CustomValue> = {};
  const errors: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(raw)) {
    const def = byKey.get(key);
    if (!def) {
      errors[`custom.${key}`] = ['unknown_field'];
      continue;
    }
    if (isEmptyValue(value)) continue;
    const parsed = valueSchemaFor(def).safeParse(value);
    if (parsed.success) values[key] = parsed.data;
    else errors[`custom.${key}`] = [...new Set(parsed.error.issues.map((i) => i.message || i.code))];
  }
  return Object.keys(errors).length ? { ok: false, errors } : { ok: true, values };
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const plain = new Intl.NumberFormat('en-US', { maximumFractionDigits: 6 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Display text for a stored value; empty string when there is none. Money shows dollars from cents. */
export function formatCustomValue(def: Pick<CustomFieldDef, 'type'>, value: unknown): string {
  if (isEmptyValue(value)) return '';
  switch (def.type) {
    case 'money':
      return typeof value === 'number' ? usd.format(value / 100) : '';
    case 'number':
      return typeof value === 'number' ? plain.format(value) : '';
    case 'date': {
      // A calendar day, so no timezone shift: 2026-10-26 is always Oct 26.
      const m = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null;
      return m ? `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}` : '';
    }
    case 'checkbox':
      return value === true ? 'Yes' : 'No';
    case 'multi_select':
      return Array.isArray(value) ? value.join(', ') : '';
    default:
      return String(value);
  }
}
