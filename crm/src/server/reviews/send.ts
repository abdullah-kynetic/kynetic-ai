import { and, eq } from 'drizzle-orm';
import type { EmailProvider } from '../adapters/email';
import type { SmsProvider } from '../adapters/sms/types';
import { recordActivity } from '../activity';
import { audit } from '../audit';
import { contacts, reviewRequests, tenantModules, tenants } from '../db/schema';
import { getEnv } from '../env';
import { enqueue, registerWorker } from '../jobs';
import { getSmsProvider, sendEmailToContact, sendSms } from '../messaging';
import type { OutboundGateOpts } from '../outbound';
import type { Tx } from '../db/client';
import { withTenant, type TenantContextInput } from '../tenancy';

// KI-030, P3-4. A queued review request is sent only when REVIEW_REQUESTS_ENABLED is on, and then
// through the same outbound gate as every other message (consent, DNC, quiet hours, kill switches).
// The review link is the `review_url` in the client's `opm` module config, set by Kynetic staff; a
// request with no link is left queued.

export type ReviewSendJob = { tenantId: string; requestId: string };

export type ReviewSendOutcome =
  | 'flag_off'
  | 'not_queued'
  | 'no_link'
  | 'sent'
  | 'held'
  | 'cancelled'
  | 'failed';

/** Reasons that will not fix themselves, so the request is cancelled and the reason logged. */
const PERMANENT = new Set([
  'no_consent',
  'consent_revoked',
  'opted_out',
  'internal_dnc',
  'no_address',
  'email_suppressed'
]);

export function reviewMessage(firstName: string, business: string, url: string): string {
  return `Hi ${firstName}, thanks for choosing ${business}. If you have a minute, would you leave us a review? ${url}`;
}

export type ReviewSendDeps = {
  envEnabled?: boolean;
  now?: Date;
  gate?: OutboundGateOpts;
  smsProvider?: SmsProvider;
  emailProvider?: EmailProvider;
};

export async function sendReviewRequest(
  job: ReviewSendJob,
  deps: ReviewSendDeps = {}
): Promise<ReviewSendOutcome> {
  if (!(deps.envEnabled ?? getEnv().REVIEW_REQUESTS_ENABLED)) return 'flag_off';
  const now = deps.now ?? new Date();
  const ctx: TenantContextInput = { tenantId: job.tenantId, role: 'system' };

  const found = await withTenant(ctx, async (tx) => {
    const [row] = await tx
      .select({
        id: reviewRequests.id,
        status: reviewRequests.status,
        channel: reviewRequests.channel,
        contactId: reviewRequests.contactId,
        firstName: contacts.firstName
      })
      .from(reviewRequests)
      .innerJoin(contacts, eq(contacts.id, reviewRequests.contactId))
      .where(eq(reviewRequests.id, job.requestId))
      .limit(1);
    if (!row) return null;
    const [tenant] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, job.tenantId))
      .limit(1);
    const [mod] = await tx
      .select({ config: tenantModules.config })
      .from(tenantModules)
      .where(and(eq(tenantModules.tenantId, job.tenantId), eq(tenantModules.moduleKey, 'opm')))
      .limit(1);
    const url = (mod?.config as { review_url?: unknown } | undefined)?.review_url;
    return {
      row,
      business: tenant?.name ?? 'us',
      url: typeof url === 'string' && /^https:\/\//.test(url) ? url : null
    };
  });
  if (!found || found.row.status !== 'queued') return 'not_queued';
  if (!found.url) return 'no_link';

  const text = reviewMessage(found.row.firstName, found.business, found.url);
  const base = {
    contactId: found.row.contactId,
    module: 'opm' as const,
    purpose: 'review_request',
    idempotencyKey: `review:${found.row.id}`,
    actor: { type: 'system' as const }
  };
  const result =
    found.row.channel === 'sms'
      ? await sendSms(
          ctx,
          { ...base, body: text },
          {
            provider: deps.smsProvider ?? getSmsProvider(),
            now,
            gate: deps.gate
          }
        )
      : await sendEmailToContact(
          ctx,
          { ...base, subject: `A quick favor from ${found.business}`, body: text },
          { provider: deps.emailProvider, now, gate: deps.gate }
        );

  const finish = async (status: 'sent' | 'cancelled', summary: string) =>
    withTenant(ctx, async (tx) => {
      await tx
        .update(reviewRequests)
        .set({ status, completedAt: status === 'cancelled' ? now.toISOString() : null })
        .where(eq(reviewRequests.id, found.row.id));
      await audit(tx, {
        action: `review.${status}`,
        entity: 'review_request',
        entityId: found.row.id,
        after: { status }
      });
      await recordActivity(tx, {
        contactId: found.row.contactId,
        type: 'system',
        refTable: 'review_request',
        refId: found.row.id,
        summary,
        actor: { type: 'system' },
        occurredAt: now
      });
    });

  if (result.status === 'sent') {
    await finish('sent', `Review request sent (${found.row.channel})`);
    return 'sent';
  }
  if (result.status === 'blocked') {
    if (PERMANENT.has(result.reason)) {
      await finish('cancelled', `Review request cancelled: ${result.reason}`);
      return 'cancelled';
    }
    // Quiet hours, a switch that is off, a pause: it stays queued and can be tried again.
    return 'held';
  }
  await finish('cancelled', `Review request cancelled: ${result.errorCode}`);
  return 'failed';
}

/** Queues the send for one request, only while the flag is on. Joins the caller's transaction. */
export async function enqueueReviewSend(tx: Tx, job: ReviewSendJob): Promise<void> {
  if (!getEnv().REVIEW_REQUESTS_ENABLED) return;
  await enqueue('review.send', job, { tx, singletonKey: job.requestId });
}

/** For after the flag is turned on: queue every request that is still waiting. */
export async function sweepQueuedReviewRequests(tenantId: string): Promise<number> {
  if (!getEnv().REVIEW_REQUESTS_ENABLED) return 0;
  const ids = await withTenant({ tenantId, role: 'system' }, (tx) =>
    tx
      .select({ id: reviewRequests.id })
      .from(reviewRequests)
      .where(eq(reviewRequests.status, 'queued'))
  );
  for (const { id } of ids) {
    await enqueue('review.send', { tenantId, requestId: id }, { singletonKey: id });
  }
  return ids.length;
}

export async function registerReviewSendWorker(): Promise<void> {
  await registerWorker<ReviewSendJob>('review.send', async (job) => {
    await sendReviewRequest(job);
  });
}
