import { parseMoneyToCents } from '@/server/deals/money';
import type { CustomFieldDef, CustomValue } from '@/server/custom-fields/types';

// Form drafts for custom field values (F-12). A draft is what the input shows: text for most types,
// a list for multi-select, a boolean for a checkbox. `valueFromDraft` turns a draft into the stored
// value; text that does not fit its type is passed on unchanged so the server refuses it and the
// form shows the reason next to the input (the service stays the only judge of what is valid).

export type CustomDraft = string | string[] | boolean;
export type CustomDrafts = Record<string, CustomDraft>;

const centsToText = (cents: number) =>
  cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);

/** The draft for one stored value. A missing value is an empty draft. */
export function draftFromValue(def: Pick<CustomFieldDef, 'type'>, value: unknown): CustomDraft {
  switch (def.type) {
    case 'checkbox':
      return value === true;
    case 'multi_select':
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
    case 'money':
      return typeof value === 'number' ? centsToText(value) : '';
    case 'number':
      return typeof value === 'number' ? String(value) : '';
    default:
      return typeof value === 'string' ? value : '';
  }
}

export function draftsFromValues(
  defs: readonly CustomFieldDef[],
  values: Record<string, unknown>
): CustomDrafts {
  return Object.fromEntries(defs.map((d) => [d.key, draftFromValue(d, values[d.key])]));
}

/**
 * The value to store for a draft, or undefined for "no value". An unchecked checkbox is no value
 * (the field was never set), and so is any blank text.
 */
export function valueFromDraft(
  def: Pick<CustomFieldDef, 'type'>,
  draft: CustomDraft | undefined
): CustomValue | undefined {
  if (draft === undefined) return undefined;
  switch (def.type) {
    case 'checkbox':
      return draft === true ? true : undefined;
    case 'multi_select':
      return Array.isArray(draft) && draft.length > 0 ? draft : undefined;
    default: {
      if (typeof draft !== 'string') return undefined;
      const text = draft.trim();
      if (text === '') return undefined;
      if (def.type === 'number') {
        const n = Number(text);
        return Number.isFinite(n) ? n : text;
      }
      if (def.type === 'money') return parseMoneyToCents(text) ?? text;
      return text;
    }
  }
}

/** The `custom` object a service takes: only fields with a value, keyed by field key. */
export function customFromDrafts(
  defs: readonly CustomFieldDef[],
  drafts: CustomDrafts
): Record<string, CustomValue> {
  const out: Record<string, CustomValue> = {};
  for (const d of defs) {
    const v = valueFromDraft(d, drafts[d.key]);
    if (v !== undefined) out[d.key] = v;
  }
  return out;
}

const REASONS: Record<string, string> = {
  not_an_option: 'Pick one of the listed options.',
  duplicate: 'Each option can be picked once.',
  invalid_type: 'This does not fit the field type.',
  too_small: 'Enter some text.',
  too_big: 'This is too long.',
  unknown_field: 'This field no longer exists. Reload the page.'
};

/** One sentence for the reasons the server returned for a field. */
export function customFieldMessage(def: Pick<CustomFieldDef, 'type'>, reasons: string[]): string {
  const known = reasons.map((r) => REASONS[r]).find(Boolean);
  if (known) return known;
  switch (def.type) {
    case 'number':
      return 'Enter a number.';
    case 'money':
      return 'Enter an amount like 12,500 or 12,500.50.';
    case 'date':
      return 'Pick a valid date.';
    default:
      return 'This is not valid.';
  }
}

/** Server field errors (`custom.<key>`) grouped by field key. */
export function customErrorsByKey(
  fieldErrors: Record<string, string[]> | undefined
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [path, reasons] of Object.entries(fieldErrors ?? {})) {
    if (path.startsWith('custom.')) out[path.slice('custom.'.length)] = reasons;
  }
  return out;
}
