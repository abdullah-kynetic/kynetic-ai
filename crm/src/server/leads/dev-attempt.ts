import { ProviderError } from '../adapters/errors';
import type { ConsentRunOpts } from '../consent/types';
import { checkDevContact, type DevContactConfig } from '../consent/dev-contact';
import type { TenantContextInput } from '../tenancy';

export const DEV_RETRY_DELAYS_MS = [90_000, 3_600_000] as const;
export type DevAttempt = { contactId: string; externalId: string; attempt: number };
export type DevRetry = { job: DevAttempt; at: Date; reason: string; key: string };
export const devAttemptKey = (ctx: TenantContextInput, job: DevAttempt) =>
  `dev-step3:${ctx.tenantId}:${job.externalId}:${job.attempt}`;

/** Dispatch is absent by default. Injected send/retry ports let synthetic tests exercise the chain. */
export async function runDevAttempt(
  ctx: TenantContextInput,
  job: DevAttempt,
  opts: ConsentRunOpts & {
    config?: DevContactConfig;
    now?: Date;
    send?: (key: string) => Promise<{ conversationId: string }>;
    schedule?: (retry: DevRetry) => Promise<void>;
  } = {}
) {
  const now = opts.now ?? new Date();
  if (
    !job.externalId.startsWith('DEV-') ||
    !Number.isInteger(job.attempt) ||
    job.attempt < 1 ||
    job.attempt > 3
  )
    throw new Error('Invalid DEV attempt');
  const defer = async (at: Date, reason: string, attempt = job.attempt) => {
    const next = { ...job, attempt };
    const retry = { job: next, at, reason, key: devAttemptKey(ctx, next) };
    await opts.schedule?.(retry);
    return { status: 'deferred' as const, ...retry };
  };
  const decision = await checkDevContact(ctx, job.contactId, now, opts);
  if (!decision.allowed) {
    if (decision.reason === 'quiet_hours' && decision.retryAt)
      return defer(decision.retryAt, 'quiet_hours');
    if (decision.reason === 'outbound_disabled' || decision.reason === 'global_pause')
      return defer(new Date(now.getTime() + 60_000), decision.reason);
    return { status: 'blocked' as const, reason: decision.reason };
  }
  if (!opts.send) return { status: 'dispatch_disabled' as const };
  try {
    return { status: 'started' as const, ...(await opts.send(devAttemptKey(ctx, job))) };
  } catch (error) {
    if (error instanceof ProviderError && error.kind === 'transient' && job.attempt < 3) {
      return defer(
        new Date(now.getTime() + DEV_RETRY_DELAYS_MS[job.attempt - 1]),
        'provider_transient',
        job.attempt + 1
      );
    }
    // Never immediately retry an uncertain dial or silently retry permanent/config errors.
    throw error;
  }
}
