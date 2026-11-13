import { eq } from 'drizzle-orm';
import { FakeEmailProvider } from '../adapters/email/fake';
import { getEmailProvider, type EmailProvider } from '../adapters/email';
import { ProviderError } from '../adapters/errors';
import { recordActivity } from '../activity';
import { contacts, messages, tenants } from '../db/schema';
import { getEnv } from '../env';
import { isEmailSuppressed } from '../email/events';
import { checkOutbound, type OutboundGateOpts, type OutboundModule } from '../outbound';
import { withTenant, type TenantContextInput } from '../tenancy';
import type { ComposeBlockReason } from './block-reasons';

// The single email dispatch to a contact, the email twin of sendSms. A send passes `checkOutbound`
// first (kill switch, module, consent, DNC), then the address check, and only then reaches a
// provider. A deny calls no provider and writes the "blocked: reason" activity.

export type SendEmailRequest = {
  contactId: string;
  module: OutboundModule;
  subject: string;
  body: string;
  idempotencyKey: string;
  purpose?: string;
  actor?: { type: 'alex' | 'automation' | 'user' | 'system'; id?: string };
};

export type SendEmailResult =
  | { status: 'sent'; messageId: string; providerId: string }
  | { status: 'blocked'; reason: ComposeBlockReason; retryAt?: Date }
  | { status: 'failed'; messageId: string; errorCode: string };

let fake: FakeEmailProvider | undefined;

/** Stub mode never reaches a real provider: it gets the in-memory fake. */
export function resolveEmailProvider(): EmailProvider | null {
  if (getEnv().PROVIDER_MODE === 'stub') return (fake ??= new FakeEmailProvider());
  try {
    return getEmailProvider();
  } catch {
    return null;
  }
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function sendEmailToContact(
  ctx: TenantContextInput,
  req: SendEmailRequest,
  deps: { provider?: EmailProvider; now?: Date; gate?: OutboundGateOpts; fromAddress?: string } = {}
): Promise<SendEmailResult> {
  const now = deps.now ?? new Date();
  const actor = req.actor ?? { type: 'automation' as const };

  type Prepared =
    | { ok: false; reason: ComposeBlockReason; retryAt?: Date }
    | { ok: true; to: string; tenantName: string };
  const prepared = await withTenant<Prepared>(ctx, async (tx) => {
    const decision = await checkOutbound(
      ctx,
      { contactId: req.contactId, channel: 'email', module: req.module, purpose: req.purpose },
      now,
      { ...deps.gate, tx }
    );
    if (!decision.allowed) {
      return {
        ok: false,
        reason: decision.reason as ComposeBlockReason,
        retryAt: decision.retryAt
      };
    }

    const [contact] = await tx
      .select({ email: contacts.primaryEmail })
      .from(contacts)
      .where(eq(contacts.id, req.contactId))
      .limit(1);
    if (!contact?.email) return { ok: false, reason: 'no_address' };
    const [tenant] = await tx
      .select({ name: tenants.name })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);
    return { ok: true, to: contact.email, tenantName: tenant?.name ?? 'Kynetic' };
  });
  if (!prepared.ok) {
    return { status: 'blocked', reason: prepared.reason, retryAt: prepared.retryAt };
  }
  if (await isEmailSuppressed(ctx.tenantId, prepared.to)) {
    return { status: 'blocked', reason: 'email_suppressed' };
  }
  const provider = deps.provider ?? resolveEmailProvider();
  if (!provider) return { status: 'blocked', reason: 'email_not_set_up' };
  const fromAddress = deps.fromAddress ?? getEnv().EMAIL_FROM_ADDRESS;

  const messageId = await withTenant(ctx, async (tx) => {
    const [row] = await tx
      .insert(messages)
      .values({
        tenantId: ctx.tenantId,
        contactId: req.contactId,
        channel: 'email',
        direction: 'outbound',
        actorType: actor.type,
        actorId: actor.id,
        fromAddress,
        toAddress: prepared.to,
        subject: req.subject,
        body: req.body,
        provider: 'resend',
        status: 'queued'
      })
      .returning({ id: messages.id });
    return row.id;
  });

  try {
    const { providerId } = await provider.send({
      tenantId: ctx.tenantId,
      to: prepared.to,
      fromName: prepared.tenantName,
      fromAddress,
      subject: req.subject,
      text: req.body,
      html: `<p>${escapeHtml(req.body).replace(/\n/g, '<br>')}</p>`,
      idempotencyKey: req.idempotencyKey
    });
    await withTenant(ctx, async (tx) => {
      await tx
        .update(messages)
        .set({ status: 'sent', providerMessageId: providerId, sentAt: now.toISOString() })
        .where(eq(messages.id, messageId));
      await recordActivity(tx, {
        contactId: req.contactId,
        type: 'email',
        refTable: 'messages',
        refId: messageId,
        summary: `Email sent: ${req.subject}`,
        actor,
        occurredAt: now
      });
    });
    return { status: 'sent', messageId, providerId };
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    await withTenant(ctx, async (tx) => {
      await tx
        .update(messages)
        .set({ status: 'failed', errorCode: e.code, errorMessage: e.message })
        .where(eq(messages.id, messageId));
      await recordActivity(tx, {
        contactId: req.contactId,
        type: 'email',
        refTable: 'messages',
        refId: messageId,
        summary: `Email failed: ${e.code}`,
        actor: { type: 'system' },
        occurredAt: now
      });
    });
    if (e.kind === 'transient' || e.kind === 'config') throw e;
    return { status: 'failed', messageId, errorCode: e.code };
  }
}
