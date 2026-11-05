import { z } from 'zod';
import { getEnv } from '../env';
import { AppError, ValidationError, errorResponse } from '../errors';
import { parseInput } from '../validation';
import { handleLeadIntake, type LeadIntakeOpts } from './intake';
import { leadPayloadSchema } from './payload';
import { assertDevPortal, businessStateSchema } from './dev-policy';

export const devLeadPayloadSchema = leadPayloadSchema.safeExtend({
  synthetic: z.literal(true),
  externalId: z.string().min(5).max(200).startsWith('DEV-'),
  businessState: businessStateSchema,
  source: z.string().regex(/^dev_[a-z0-9_-]{1,35}$/),
  phone: z.string().regex(/^\+[1-9]\d{7,14}$/)
});

export function parseDevLead(
  input: unknown,
  config: { APP_BASE_URL: string; TEST_PHONE?: string }
) {
  assertDevPortal(config.APP_BASE_URL);
  const lead = parseInput(devLeadPayloadSchema, input);
  if (!config.TEST_PHONE || !/^\+[1-9]\d{7,14}$/.test(config.TEST_PHONE))
    throw new AppError('FORBIDDEN', { message: 'TEST_PHONE is not configured.' });
  if (lead.phone !== config.TEST_PHONE) throw new ValidationError({ phone: ['test_phone_only'] });
  return lead;
}

/** Signature, rate limits, tenant/module checks and durable webhook deduplication stay in intake.ts. */
export async function devLeadIntakeResponse(
  request: Request,
  tenantKey: string,
  opts: LeadIntakeOpts = {}
) {
  try {
    const config = getEnv();
    assertDevPortal(config.APP_BASE_URL);
    return await handleLeadIntake(request, tenantKey, {
      ...opts,
      validate: (input) => parseDevLead(input, config)
    });
  } catch (error) {
    return errorResponse(error);
  }
}
