import { eq } from 'drizzle-orm';
import { contacts } from '../db/schema';
import type { ConsentRunOpts } from './types';
import type { TenantContextInput } from '../tenancy';
import { checkOutbound } from '../outbound/gate';
import { getEnv } from '../env';
import { AppError } from '../errors';
import { run } from './run';
import { assertDevPortal } from '../leads/dev-policy';

export type DevContactConfig = {
  APP_BASE_URL: string;
  TEST_PHONE?: string;
  OUTBOUND_ENABLED: boolean;
};

/** Always use the real server gate, then pin the persisted destination to TEST_PHONE. */
export function checkDevContact(
  ctx: TenantContextInput,
  contactId: string,
  now: Date,
  opts: ConsentRunOpts & { config?: DevContactConfig } = {}
) {
  const config = opts.config ?? getEnv();
  assertDevPortal(config.APP_BASE_URL);
  if (!config.TEST_PHONE || !/^\+[1-9]\d{7,14}$/.test(config.TEST_PHONE))
    throw new AppError('FORBIDDEN', { message: 'TEST_PHONE is not configured.' });
  return run(ctx, opts, async (tx) => {
    const decision = await checkOutbound(
      ctx,
      { contactId, channel: 'phone_call', module: 'alex_core', purpose: 'dev_step3' },
      now,
      { tx, outboundEnabled: config.OUTBOUND_ENABLED }
    );
    if (!decision.allowed) return decision;
    const [contact] = await tx
      .select({ phone: contacts.primaryPhoneE164 })
      .from(contacts)
      .where(eq(contacts.id, contactId))
      .limit(1);
    if (!contact || contact.phone !== config.TEST_PHONE)
      throw new AppError('FORBIDDEN', { message: 'Dev contact destination mismatch.' });
    return decision;
  });
}
