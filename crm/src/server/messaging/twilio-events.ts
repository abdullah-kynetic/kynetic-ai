import { and, eq, or, sql } from 'drizzle-orm';
import type { SmsProvider } from '../adapters/sms/types';
import type { VerifiedInboundSms, VerifiedSmsStatus } from '../adapters/sms/types';
import { recordActivity } from '../activity';
import { addDncEntry, revokeConsent } from '../consent';
import { getWorkerDb, type Db } from '../db/client';
import { contacts, integrations, messages, tenants } from '../db/schema';
import { emitEvent } from '../events';
import type { OutboundGateOpts } from '../outbound';
import { notify } from '../notifications';
import { registerWebhookProcessor, type WebhookProcessor } from '../webhooks';
import { withTenant, type TenantContextInput } from '../tenancy';
import { sendSms } from './sms';

// F-74, F-30, SECURITY 3.3. The routes verify the signature and store the event; this processor
// runs in the worker. The tenant comes from our own number mapping (SECURITY 3.6 item 6).

export const TWILIO_SOURCE = 'twilio';

export type TwilioEventPayload =
  | { kind: 'status'; event: VerifiedSmsStatus }
  | { kind: 'inbound'; event: VerifiedInboundSms };

const FREE_TEXT_OPT_OUT =
  /\b(do not|don'?t|stop)\s+(contact|text|message|call)\b|\bleave me alone\b|\bremove me\b/i;

async function tenantForNumber(db: Db, e164: string | undefined): Promise<string | null> {
  if (!e164) return null;
  const rows = await db.execute<{ tenant_id: string }>(
    sql`SELECT tenant_id FROM phone_number_tenant_lookup(${e164})`
  );
  return rows[0]?.tenant_id ?? null;
}

export type TwilioProcessorDeps = { provider: SmsProvider; db?: Db; gate?: OutboundGateOpts };

export function createTwilioProcessor(deps: TwilioProcessorDeps): WebhookProcessor {
  const db = () => deps.db ?? getWorkerDb();
  return async (row) => {
    const payload = row.payload as TwilioEventPayload;
    const ourNumber = payload.kind === 'inbound' ? payload.event.toE164 : payload.event.fromE164;
    const tenantId = await tenantForNumber(db(), ourNumber);
    // A number we do not own (released or never ours) maps to no tenant; nothing to apply.
    if (!tenantId) return;
    const ctx: TenantContextInput = { tenantId, role: 'system' };
    if (payload.kind === 'status') await applyStatus(ctx, payload.event, db());
    else await applyInbound(ctx, payload.event, deps, db());
  };
}

export function registerTwilioProcessor(deps: TwilioProcessorDeps): void {
  registerWebhookProcessor(TWILIO_SOURCE, createTwilioProcessor(deps));
}

async function applyStatus(ctx: TenantContextInput, ev: VerifiedSmsStatus, db: Db) {
  await withTenant(
    ctx,
    async (tx) => {
      const [msg] = await tx
        .select({ id: messages.id, status: messages.status, contactId: messages.contactId })
        .from(messages)
        .where(and(eq(messages.provider, 'twilio'), eq(messages.providerMessageId, ev.providerId)))
        .limit(1);
      if (!msg) return;
      const next = ev.status === 'undelivered' ? 'failed' : ev.status;
      // A late "sent" must not undo "delivered", and a final state is not rewritten.
      if (msg.status === next || msg.status === 'delivered' || msg.status === 'failed') return;
      const now = new Date().toISOString();
      await tx
        .update(messages)
        .set({
          status: next,
          ...(next === 'delivered' ? { deliveredAt: now } : {}),
          ...(next === 'failed'
            ? { errorCode: ev.errorCode ?? ev.status, errorMessage: `Twilio ${ev.status}` }
            : {})
        })
        .where(eq(messages.id, msg.id));
      if (next === 'failed') {
        await tx
          .update(integrations)
          .set({
            lastErrorAt: now,
            lastError: `sms ${ev.errorCode ?? ev.status}`,
            errorCount: sql`${integrations.errorCount} + 1`
          })
          .where(and(eq(integrations.tenantId, ctx.tenantId), eq(integrations.kind, 'sms')));
      }
      await recordActivity(tx, {
        contactId: msg.contactId,
        type: 'sms',
        refTable: 'messages',
        refId: msg.id,
        summary:
          next === 'delivered' ? 'Text delivered' : next === 'failed' ? 'Text failed' : 'Text sent',
        actor: { type: 'system' }
      });
      await emitEvent(tx, {
        name: 'message.status_changed',
        tenantId: ctx.tenantId,
        actor: { type: 'system' },
        payload: { messageId: msg.id, status: next }
      });
    },
    { db }
  );
}

async function applyInbound(
  ctx: TenantContextInput,
  ev: VerifiedInboundSms,
  deps: TwilioProcessorDeps,
  db: Db
) {
  const reply = await withTenant(
    ctx,
    async (tx) => {
      const matches = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(
          and(
            sql`${contacts.deletedAt} IS NULL AND ${contacts.mergedIntoId} IS NULL`,
            or(
              eq(contacts.primaryPhoneE164, ev.fromE164),
              sql`${ev.fromE164} = ANY(${contacts.phones})`
            )
          )
        );
      const contactId = matches[0]?.id ?? null;
      const [stored] = await tx
        .insert(messages)
        .values({
          tenantId: ctx.tenantId,
          contactId,
          channel: 'sms',
          direction: 'inbound',
          actorType: 'system',
          fromAddress: ev.fromE164,
          toAddress: ev.toE164,
          body: ev.body,
          provider: 'twilio',
          providerMessageId: ev.providerId,
          status: 'received',
          deliveredAt: new Date().toISOString()
        })
        .onConflictDoNothing()
        .returning({ id: messages.id });
      // Already stored: a redelivered job must not revoke or reply twice.
      if (!stored) return null;

      await recordActivity(tx, {
        contactId,
        type: 'sms',
        refTable: 'messages',
        refId: stored.id,
        summary: 'Text received',
        actor: { type: 'system' }
      });
      await emitEvent(tx, {
        name: 'message.received',
        tenantId: ctx.tenantId,
        actor: { type: 'system' },
        payload: { messageId: stored.id, contactId }
      });

      const [tenant] = await tx
        .select({ name: tenants.name, phone: tenants.transferNumberE164 })
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      const business = tenant?.name ?? 'us';

      if (ev.isStop) {
        // STOP revokes SMS only (SECURITY 3.3), in the transaction that stores the message.
        for (const c of matches) {
          await revokeConsent(
            ctx,
            {
              contactId: c.id,
              channel: 'sms',
              source: 'sms_keyword',
              capturedText: ev.body.trim()
            },
            { tx }
          );
          await emitEvent(tx, {
            name: 'consent.revoked',
            tenantId: ctx.tenantId,
            actor: { type: 'system' },
            payload: { contactId: c.id, channel: 'sms' }
          });
        }
        // A number with no contact yet: block it by number so a later contact is not texted.
        if (!matches.length) {
          await addDncEntry(ctx, { e164: ev.fromE164, source: 'opt_out' }, { tx });
        }
        return contactId
          ? {
              contactId,
              body: `You are unsubscribed from ${business} texts. No more messages will be sent.`
            }
          : null;
      }
      if (ev.isHelp) {
        const contact = tenant?.phone ? ` Call ${tenant.phone}.` : '';
        return contactId
          ? {
              contactId,
              body: `${business}: for help, contact us directly.${contact} Reply stop to opt out.`
            }
          : null;
      }
      if (FREE_TEXT_OPT_OUT.test(ev.body)) {
        await recordActivity(tx, {
          contactId,
          type: 'system',
          summary: 'Text may be an opt-out request: review',
          actor: { type: 'system' },
          meta: { flaggedForReview: true, messageId: stored.id }
        });
        await notify(tx, {
          type: 'action_needed',
          title: 'A contact may have asked not to be contacted',
          body: 'A text reply reads like an opt-out. Review it and record it if so.'
        });
      }
      return null;
    },
    { db }
  );

  if (!reply) return;
  try {
    await sendSms(
      ctx,
      {
        contactId: reply.contactId,
        module: 'alex_core',
        body: reply.body,
        idempotencyKey: `reply:${ev.providerId}`,
        purpose: ev.isStop ? 'opt_out_confirmation' : 'help_reply',
        actor: { type: 'system' },
        replyToInbound: true
      },
      { provider: deps.provider, gate: deps.gate }
    );
  } catch (e) {
    // The opt-out is already recorded; Twilio also confirms STOP at carrier level.
    console.error(JSON.stringify({ level: 'error', msg: 'sms reply failed', error: String(e) }));
  }
}
