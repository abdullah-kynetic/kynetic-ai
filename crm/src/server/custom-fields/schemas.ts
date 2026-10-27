import { z } from 'zod';
import { uuidSchema } from '../validation';
import {
  CUSTOM_FIELD_ENTITIES,
  CUSTOM_FIELD_TYPES,
  FIELD_KEY_PATTERN,
  MAX_FIELD_OPTIONS,
  MAX_LABEL_LENGTH,
  MAX_OPTION_LENGTH,
  isSelectType
} from './types';

const labelSchema = z.string().trim().min(1).max(MAX_LABEL_LENGTH);

/** Trimmed, no blanks, no repeats (case-sensitive: "Tile" and "tile" are different stored values). */
const optionsSchema = z
  .array(z.string().trim().min(1).max(MAX_OPTION_LENGTH))
  .max(MAX_FIELD_OPTIONS)
  .refine((a) => new Set(a).size === a.length, 'duplicate');

export const createFieldDefSchema = z
  .strictObject({
    entity: z.enum(CUSTOM_FIELD_ENTITIES),
    key: z.string().regex(FIELD_KEY_PATTERN, 'invalid_key'),
    label: labelSchema,
    type: z.enum(CUSTOM_FIELD_TYPES),
    options: optionsSchema.default([]),
    showInTable: z.boolean().default(false),
    filterable: z.boolean().default(false),
    importable: z.boolean().default(true)
  })
  .superRefine((v, ctx) => {
    if (isSelectType(v.type) && v.options.length === 0) {
      ctx.addIssue({ code: 'custom', message: 'options_required', path: ['options'] });
    }
    if (!isSelectType(v.type) && v.options.length > 0) {
      ctx.addIssue({ code: 'custom', message: 'options_not_allowed', path: ['options'] });
    }
  });
export type CreateFieldDefInput = z.input<typeof createFieldDefSchema>;

/** Entity, key and type never change: stored values depend on them. Delete and re-create instead. */
export const updateFieldDefSchema = z
  .strictObject({
    label: labelSchema,
    options: optionsSchema,
    showInTable: z.boolean(),
    filterable: z.boolean(),
    importable: z.boolean()
  })
  .partial();
export type UpdateFieldDefInput = z.input<typeof updateFieldDefSchema>;

export const reorderFieldDefsSchema = z.strictObject({
  entity: z.enum(CUSTOM_FIELD_ENTITIES),
  ids: z.array(uuidSchema).min(1).max(MAX_FIELD_OPTIONS)
});
