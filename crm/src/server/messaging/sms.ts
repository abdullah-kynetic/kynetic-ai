import { and, eq, inArray, isNull } from 'drizzle-orm';
import { ProviderError } from '../adapters/errors';
import type { SmsProvider } from '../adapters/sms/types';
import { recordActivity } from '../activity';
import { contacts, messages, phoneNumbers } from '../db/schema';
import { checkOutbound, type OutboundGateOpts, type OutboundModule } from '../outbound';
import { withTenant, type TenantContextInput } from '../tenancy';

// The single SMS dispatch (SEC-T-13): the only caller of an SmsProvider. A send passes
// `checkOutbound` first, which denies `sms_not_approved` until an admin marks the tenant's number
// approved (SECURITY 3.7); a deny calls no provider and writes the "blocked: reason" activity.

export type SendSmsRequest = {
  contactId: string;
  module: OutboundModule;
  body: string;
  idempotencyKey: string;
  purpose?: string;
  actor?: { type: 'alex' | 'automation' | 'user' | 'system'; id?: string };
  /** The one reply to an inbound STOP or HELP; see OutboundGateOpts.replyToInbound. */
  replyToInbound?: boolean;
};

export type SendSmsResult =
  | { status: 'sent'; messageId: string; providerId: string }
  | { status: 'blocked'; reason: string; retryAt?: Date }
  | { status: 'failed'; messageId: string; errorCode: string };

export async function sendSms(
  ctx: TenantContextInput,
  req: SendSmsRequest,
  deps: { provider: SmsProvider; now?: Date; gate?: OutboundGateOpts }
): Promise<SendSmsResult> {
  const now = deps.now ?? new Date();
  const actor = req.actor ?? { type: 'automation' as const };

  const prepared = await withTenant(ctx, async (tx) => {
    const decision = await checkOutbound(
      ctx,
      { contactId: req.contactId, channel: 'sms', module: req.module, purpose: req.purpose },
      now,
      { ...deps.gate, tx, replyToInbound: req.replyToInbound }
    );
    if (!decision.allowed) return { decision } as const;

    const [contact] = await tx
      .select({ phone: contacts.primaryPhoneE164 })
      .from(contacts)
      .where(eq(contacts.id, req.contactId))
      .limit(1);
    const [from] = await tx
      .select({ e164: phoneNumbers.e164 })
      .from(phoneNumbers)
      .where(
        and(
          eq(phoneNumbers.tenantId, ctx.tenantId),
          eq(phoneNumbers.a2PStatus, 'approved'),
          inArray(phoneNumbers.purpose, ['sms', 'voice_sms']),
          isNull(phoneNumbers.releasedAt)
        )
      )
      .limit(1);
    // Without a phone or a sending number there is nothing to send; treat as not approved.
    if (!contact?.phone || !from) {
      return { decision: { allowed: false, reason: 'sms_not_approved' } } as const;
    }
    const [row] = await tx
      .insert(messages)
      .values({
        tenantId: ctx.tenantId,
        contactId: req.contactId,
        channel: 'sms',
        direction: 'outbound',
        actorType: actor.type,
        actorId: actor.id,
        fromAddress: from.e164,
        toAddress: contact.phone,
        body: req.body,
        provider: 'twilio',
        status: 'queued'
      })
      .returning({ id: messages.id });
    return { decision, messageId: row.id, to: contact.phone, from: from.e164 } as const;
  });

  if (!prepared.decision.allowed) {
    return {
      status: 'blocked',
      reason: prepared.decision.reason,
      retryAt: 'retryAt' in prepared.decision ? prepared.decision.retryAt : undefined
    };
  }
  const { messageId, to, from } = prepared as { messageId: string; to: string; from: string };

  try {
    const { providerId } = await deps.provider.send({
      tenantId: ctx.tenantId,
      toE164: to,
      fromE164: from,
      body: req.body,
      idempotencyKey: req.idempotencyKey
    });
    await withTenant(ctx, async (tx) => {
      await tx
        .update(messages)
        .set({ status: 'sent', providerMessageId: providerId, sentAt: now.toISOString() })
        .where(eq(messages.id, messageId));
      await recordActivity(tx, {
        contactId: req.contactId,
        type: 'sms',
        refTable: 'messages',
        refId: messageId,
        summary: 'Text sent',
        actor,
        occurredAt: now
      });
    });
    return { status: 'sent', messageId, providerId };
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    // The failure is stored with its error. A registration error is permanent and not retried.
    await withTenant(ctx, async (tx) => {
      await tx
        .update(messages)
        .set({ status: 'failed', errorCode: e.code, errorMessage: e.message })
        .where(eq(messages.id, messageId));
      await recordActivity(tx, {
        contactId: req.contactId,
        type: 'sms',
        refTable: 'messages',
        refId: messageId,
        summary: `Text failed: ${e.code}`,
        actor: { type: 'system' },
        occurredAt: now
      });
    });
    if (e.kind === 'transient' || e.kind === 'config') throw e;
    return { status: 'failed', messageId, errorCode: e.code };
  }
}
