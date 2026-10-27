import { z } from 'zod';
import { emailSchema, FIELD_LIMITS, nameSchema, uuidSchema } from '../validation';
import { normalizePhone } from './phone';

export const CONTACT_STATUSES = ['new', 'working', 'booked', 'won', 'lost', 'dead'] as const;
export type ContactStatus = (typeof CONTACT_STATUSES)[number];

/** A phone as typed by a person or sent by a form. Output is E.164. */
export const phoneInputSchema = z
  .string()
  .trim()
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (n === null) {
      ctx.addIssue({ code: 'custom', message: 'invalid_phone' });
      return z.NEVER;
    }
    return n;
  });

const tagSchema = z.string().trim().min(1).max(50);

/** Trims, drops blanks, and removes repeats ignoring case (first spelling wins). */
export function uniqueTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const key = t.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      out.push(t);
    }
  }
  return out;
}

const tagsSchema = z
  .array(tagSchema)
  .transform(uniqueTags)
  .pipe(z.array(z.string()).max(FIELD_LIMITS.tagsPerContact));

const uniq = <T>(a: T[]): T[] => [...new Set(a)];

const fields = {
  firstName: nameSchema.or(z.literal('')),
  lastName: nameSchema.nullable(),
  companyId: uuidSchema.nullable(),
  /** First entry is the primary phone. */
  phones: z.array(phoneInputSchema).max(10).transform(uniq),
  /** First entry is the primary email. */
  emails: z.array(emailSchema).max(10).transform(uniq),
  address: z.record(z.string(), z.unknown()),
  timezone: z.string().trim().min(1).max(64).nullable(),
  source: z.string().trim().min(1).max(100).nullable(),
  status: z.enum(CONTACT_STATUSES),
  tags: tagsSchema,
  ownerId: uuidSchema.nullable(),
  custom: z.record(z.string(), z.unknown())
};

/** At least one phone or email is required, matching the contacts CHECK (DATABASE Data validation). */
export const createContactSchema = z
  .strictObject({
    firstName: fields.firstName.default(''),
    lastName: fields.lastName.optional(),
    companyId: fields.companyId.optional(),
    phones: fields.phones.default([]),
    emails: fields.emails.default([]),
    address: fields.address.default({}),
    timezone: fields.timezone.optional(),
    source: fields.source.optional(),
    status: fields.status.default('new'),
    tags: fields.tags.default([]),
    ownerId: fields.ownerId.optional(),
    custom: fields.custom.default({})
  })
  .refine((v) => v.phones.length + v.emails.length > 0, {
    message: 'phone_or_email_required',
    path: ['phones']
  });
export type CreateContactInput = z.input<typeof createContactSchema>;

export const updateContactSchema = z
  .strictObject({
    firstName: fields.firstName,
    lastName: fields.lastName,
    companyId: fields.companyId,
    phones: fields.phones,
    emails: fields.emails,
    address: fields.address,
    timezone: fields.timezone,
    source: fields.source,
    status: fields.status,
    tags: fields.tags,
    ownerId: fields.ownerId,
    custom: fields.custom
  })
  .partial();
export type UpdateContactInput = z.input<typeof updateContactSchema>;

export const listContactsSchema = z.strictObject({
  limit: z
    .number()
    .int()
    .min(1)
    .max(FIELD_LIMITS.listLimitMax)
    .default(FIELD_LIMITS.listLimitDefault),
  offset: z.number().int().min(0).default(0)
});
export type ListContactsInput = z.input<typeof listContactsSchema>;
