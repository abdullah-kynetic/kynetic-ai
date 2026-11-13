import { z } from 'zod';
import { CONSENT_CHANNELS } from '../consent/types';
import { emailSchema, FIELD_LIMITS } from '../validation';

// The normalized lead shape every source maps into (forms, Angi, Google LSA, Facebook, n8n). Strict:
// unknown keys are rejected (SEC-T-27). Field contents are untrusted text.

const US_STATES = new Set(
  'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(
    ' '
  )
);
const businessStateSchema = z
  .string()
  .trim()
  .transform((value) => {
    const state = value.toUpperCase();
    return state === 'FLORIDA' ? 'FL' : state === 'OKLAHOMA' ? 'OK' : state;
  })
  .refine(
    (value) => US_STATES.has(value) && value !== 'FL' && value !== 'OK',
    'unsupported_business_state'
  );

export const LEAD_BODY_MAX_BYTES = 16_000;

/** US and Canada national numbers or full E.164. Anything else is refused rather than guessed. */
export function normalizePhone(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/\D/g, '');
  if (trimmed.startsWith('+'))
    return digits.length >= 8 && digits.length <= 15 && digits[0] !== '0' ? `+${digits}` : null;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

const phoneSchema = z
  .string()
  .max(40)
  .transform((v, ctx) => {
    const e164 = normalizePhone(v);
    if (!e164) ctx.addIssue({ code: 'custom', message: 'phone' });
    return e164 ?? '';
  });

const text = (max: number) => z.string().trim().min(1).max(max);

export const leadPayloadSchema = z
  .strictObject({
    /** The provider's own id for this lead. With `source` it makes a retry a no-op. */
    externalId: text(200),
    /** Where the lead came from, for reporting. */
    source: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9_-]{1,40}$/),
    firstName: text(FIELD_LIMITS.name).optional(),
    lastName: text(FIELD_LIMITS.name).optional(),
    phone: phoneSchema.optional(),
    email: emailSchema.optional(),
    serviceType: text(FIELD_LIMITS.name).optional(),
    projectType: text(FIELD_LIMITS.name).optional(),
    budget: text(200).optional(),
    businessState: businessStateSchema.optional(),
    message: text(FIELD_LIMITS.customText).optional(),
    address: z
      .strictObject({
        line1: text(200).optional(),
        city: text(100).optional(),
        region: text(100).optional(),
        postalCode: text(20).optional()
      })
      .optional(),
    /** Present only when the form showed consent wording; becomes an express-written consent row. */
    consent: z
      .strictObject({
        capturedText: text(FIELD_LIMITS.customText),
        wordingVersion: text(100).optional(),
        capturedAt: z.iso.datetime().optional(),
        ip: z.union([z.ipv4(), z.ipv6()]).optional(),
        channels: z.array(z.enum(CONSENT_CHANNELS)).min(1).max(3).default(['phone_call'])
      })
      .optional()
  })
  .refine((v) => !!v.phone || !!v.email, {
    message: 'phone or email is required',
    path: ['phone']
  });

export type LeadPayload = z.output<typeof leadPayloadSchema>;
