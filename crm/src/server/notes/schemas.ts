import { z } from 'zod';
import { FIELD_LIMITS, uuidSchema } from '../validation';

// The editor sends HTML; the limit is on the HTML so markup cannot be used to dodge it.
const html = z.string().max(FIELD_LIMITS.note);

const parent = {
  contactId: uuidSchema.optional(),
  companyId: uuidSchema.optional(),
  dealId: uuidSchema.optional()
};
const oneParent = (v: { contactId?: string; companyId?: string; dealId?: string }) =>
  [v.contactId, v.companyId, v.dealId].filter(Boolean).length === 1;
const oneParentIssue = { message: 'Pass exactly one of contactId, companyId or dealId.' };

export const createNoteSchema = z
  .strictObject({ ...parent, html, pinned: z.boolean().default(false) })
  .refine(oneParent, { ...oneParentIssue, path: ['contactId'] });
export type CreateNoteInput = z.input<typeof createNoteSchema>;

export const updateNoteSchema = z
  .strictObject({ html: html.optional(), pinned: z.boolean().optional() })
  .refine((v) => v.html !== undefined || v.pinned !== undefined, {
    message: 'Nothing to update.',
    path: ['html']
  });
export type UpdateNoteInput = z.input<typeof updateNoteSchema>;

export const listNotesSchema = z
  .strictObject({
    ...parent,
    limit: z
      .number()
      .int()
      .min(1)
      .max(FIELD_LIMITS.listLimitMax)
      .default(FIELD_LIMITS.listLimitDefault)
  })
  .refine(oneParent, { ...oneParentIssue, path: ['contactId'] });
export type ListNotesInput = z.input<typeof listNotesSchema>;
