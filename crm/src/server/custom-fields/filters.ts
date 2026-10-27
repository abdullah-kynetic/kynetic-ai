import { sql, type AnyColumn, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import { ValidationError } from '../errors';
import { FIELD_KEY_PATTERN, MAX_FIELD_OPTIONS, type CustomFieldDef } from './types';

// Custom field filters (M1-06; PRD F-12 "can be filtered"). A filter is keyed by field key and
// shaped by the field's type, and only fields marked `filterable` accept one. The SQL reads the
// `custom` jsonb column of the list's table, so it stays inside the caller's tenant with the rows.

export const customFilterSchema = z.union([
  /** select, multi-select (any of the options) and checkbox ('true' / 'false'). */
  z.strictObject({ any: z.array(z.string().min(1).max(100)).min(1).max(MAX_FIELD_OPTIONS) }),
  /** text: contains, ignoring case. */
  z.strictObject({ contains: z.string().trim().min(1).max(200) }),
  /** number and money (whole cents): equals. */
  z.strictObject({ eq: z.number().finite() }),
  /** date: an inclusive range of calendar days, either end optional. */
  z
    .strictObject({ from: z.iso.date().optional(), to: z.iso.date().optional() })
    .refine((v) => v.from !== undefined || v.to !== undefined, 'empty_range')
]);
export type CustomFilter = z.output<typeof customFilterSchema>;

export type CheckedCustomFilter = { def: CustomFieldDef; filter: CustomFilter };

const KIND_FOR_TYPE: Record<CustomFieldDef['type'], 'any' | 'contains' | 'eq' | 'range'> = {
  select: 'any',
  multi_select: 'any',
  checkbox: 'any',
  text: 'contains',
  number: 'eq',
  money: 'eq',
  date: 'range'
};

const kindOf = (f: CustomFilter) =>
  'any' in f ? 'any' : 'contains' in f ? 'contains' : 'eq' in f ? 'eq' : 'range';

/** Pairs each filter with its definition; rejects unknown keys, fields not marked filterable, and a filter of the wrong shape. */
export function checkCustomFilters(
  defs: readonly CustomFieldDef[],
  filters: Record<string, CustomFilter>
): CheckedCustomFilter[] {
  const errors: Record<string, string[]> = {};
  const out: CheckedCustomFilter[] = [];
  for (const [key, filter] of Object.entries(filters)) {
    const def = defs.find((d) => d.key === key);
    if (!FIELD_KEY_PATTERN.test(key) || !def) errors[`custom.${key}`] = ['unknown_field'];
    else if (!def.filterable) errors[`custom.${key}`] = ['not_filterable'];
    else if (kindOf(filter) !== KIND_FOR_TYPE[def.type]) errors[`custom.${key}`] = ['wrong_filter'];
    else out.push({ def, filter });
  }
  if (Object.keys(errors).length) throw new ValidationError(errors);
  return out;
}

const textArray = (values: string[]) =>
  sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}]::text[]`;

const like = (s: string) => `%${s.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

/** One WHERE condition for a checked filter, against the `custom` column of the table being listed. */
export const customFilterSql =
  (column: AnyColumn) =>
  ({ def, filter }: CheckedCustomFilter): SQL => {
    const text = sql`(${column} ->> ${def.key}::text)`;
    if ('any' in filter) {
      if (def.type === 'multi_select') {
        return sql`(${column} -> ${def.key}::text) ?| ${textArray(filter.any)}`;
      }
      if (def.type === 'checkbox') {
        // No stored value reads as unticked, so "No" also finds records that never set the box.
        const wanted = filter.any.map((v) => v === 'true');
        return sql`coalesce(${text}::boolean, false) = ANY(${sql.raw(`ARRAY[${wanted.join(',')}]::boolean[]`)})`;
      }
      return sql`${text} = ANY(${textArray(filter.any)})`;
    }
    if ('contains' in filter) return sql`${text} ILIKE ${like(filter.contains)}`;
    if ('eq' in filter) return sql`${text}::numeric = ${filter.eq}`;
    const bounds: SQL[] = [];
    if (filter.from) bounds.push(sql`${text} >= ${filter.from}`);
    if (filter.to) bounds.push(sql`${text} <= ${filter.to}`);
    return sql`(${sql.join(bounds, sql` AND `)})`;
  };
