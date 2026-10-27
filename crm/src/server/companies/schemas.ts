import { z } from 'zod';
import { FIELD_LIMITS, nameSchema } from '../validation';
import { phoneInputSchema } from '../contacts/schemas';

// Companies (M1-05; PRD F-10; DATABASE companies). Same trust-boundary rules as contacts: phones are
// stored as E.164, unknown keys are rejected.

/** A website as typed. Only http(s) is kept so the detail page can safely render it as a link. */
export const websiteSchema = z
  .string()
  .trim()
  .max(300)
  .transform((v, ctx) => {
    const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(v) ? v : `https://${v}`;
    try {
      const u = new URL(withScheme);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('scheme');
      if (!u.hostname.includes('.')) throw new Error('host');
      return u.toString();
    } catch {
      ctx.addIssue({ code: 'custom', message: 'invalid_website' });
      return z.NEVER;
    }
  });

const fields = {
  name: nameSchema,
  phone: phoneInputSchema.nullable(),
  website: websiteSchema.nullable(),
  address: z.record(z.string(), z.unknown()),
  custom: z.record(z.string(), z.unknown())
};

export const createCompanySchema = z.strictObject({
  name: fields.name,
  phone: fields.phone.optional(),
  website: fields.website.optional(),
  address: fields.address.default({}),
  custom: fields.custom.default({})
});
export type CreateCompanyInput = z.input<typeof createCompanySchema>;

export const updateCompanySchema = z.strictObject(fields).partial();
export type UpdateCompanyInput = z.input<typeof updateCompanySchema>;

export const listCompaniesSchema = z.strictObject({
  /** Case-insensitive match on the name. */
  q: z.string().trim().max(FIELD_LIMITS.name).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(FIELD_LIMITS.listLimitMax)
    .default(FIELD_LIMITS.listLimitDefault),
  offset: z.number().int().min(0).default(0)
});
export type ListCompaniesInput = z.input<typeof listCompaniesSchema>;
