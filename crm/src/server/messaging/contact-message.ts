import { randomUUID } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';
import type { EmailProvider } from '../adapters/email';
import type { SmsProvider } from '../adapters/sms/types';
import { contacts, messages, tenants } from '../db/schema';
import { isEmailSuppressed } from '../email/events';
import { AppError } from '../errors';
import { checkOutbound, type OutboundGateOpts } from '../outbound';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { describeBlock, type ComposeBlockReason } from './block-reasons';
import { sendEmailToContact } from './email';
import { getSmsProvider } from './provider';
import { sendSms } from './sms';

// Manual messages from the contact page (F-47). One entry point per action: it validates, runs the
// shared sends (which pass the outbound gate), and turns a block into words for the compose box.

export const composeSchema = z.discriminatedUnion('channel', [
  z.strictObject({
    contactId: uuidSchema,
    channel: z.literal('sms'),
    body: z.string().trim().min(1).max(1000)
  }),
  z.strictObject({
    contactId: uuidSchema,
    channel: z.literal('email'),
    subject: z.string().trim().min(1).max(200),
    body: z.string().trim().min(1).max(5000)
  })
]);
export type ComposeInput = z.input<typeof composeSchema>;

export type ComposeResult =
  | { status: 'sent'; messageId: string }
  | { status: 'blocked'; reason: ComposeBlockReason; message: string }
  | { status: 'failed'; message: string };

export type ContactMessageDeps = {
  smsProvider?: SmsProvider;
  emailProvider?: EmailProvider;
  now?: Date;
  gate?: OutboundGateOpts;
};

async function tenantZone(ctx: TenantContextInput): Promise<string> {
  return withTenant(ctx, async (tx) => {
    const [row] = await tx
      .select({ timezone: tenants.timezone })
      .from(tenants)
      .where(eq(tenants.id, ctx.tenantId))
      .limit(1);
    return row?.timezone ?? 'UTC';
  });
}

export async function sendContactMessage(
  ctx: TenantContextInput,
  input: ComposeInput,
  deps: ContactMessageDeps = {}
): Promise<ComposeResult> {
  const value = parseInput(composeSchema, input);
  if (ctx.readOnly || !ctx.userId) throw new AppError('FORBIDDEN');
  const actor = { type: 'user' as const, id: ctx.userId };
  const idempotencyKey = `manual:${randomUUID()}`;

  if (value.channel === 'sms') {
    const peek = await contactAddress(ctx, value.contactId);
    if (!peek.phone) return blocked('no_address', 'sms');
    const r = await sendSms(
      ctx,
      {
        contactId: value.contactId,
        module: 'crm',
        body: value.body,
        idempotencyKey,
        purpose: 'manual_message',
        actor
      },
      { provider: deps.smsProvider ?? getSmsProvider(), now: deps.now, gate: deps.gate }
    );
    if (r.status === 'sent') return { status: 'sent', messageId: r.messageId };
    if (r.status === 'blocked') {
      return blocked(
        r.reason as ComposeBlockReason,
        'sms',
        r.retryAt,
        r.retryAt ? await tenantZone(ctx) : undefined
      );
    }
    return { status: 'failed', message: 'The text could not be delivered. Try again later.' };
  }

  const r = await sendEmailToContact(
    ctx,
    {
      contactId: value.contactId,
      module: 'crm',
      subject: value.subject,
      body: value.body,
      idempotencyKey,
      purpose: 'manual_message',
      actor
    },
    { provider: deps.emailProvider, now: deps.now, gate: deps.gate }
  );
  if (r.status === 'sent') return { status: 'sent', messageId: r.messageId };
  if (r.status === 'blocked') return blocked(r.reason, 'email', r.retryAt);
  return { status: 'failed', message: 'The email could not be delivered. Try again later.' };
}

function blocked(
  reason: ComposeBlockReason,
  channel: 'sms' | 'email',
  retryAt?: Date,
  zone?: string
): ComposeResult {
  return { status: 'blocked', reason, message: describeBlock(reason, channel, retryAt, zone) };
}

async function contactAddress(ctx: TenantContextInput, contactId: string) {
  return withTenant(ctx, async (tx) => {
    const [row] = await tx
      .select({ phone: contacts.primaryPhoneE164, email: contacts.primaryEmail })
      .from(contacts)
      .where(
        and(eq(contacts.id, contactId), isNull(contacts.deletedAt), isNull(contacts.mergedIntoId))
      )
      .limit(1);
    if (!row) throw new AppError('NOT_FOUND');
    return row;
  });
}

export type ChannelState = { channel: 'sms' | 'email'; canSend: boolean; message: string | null };

/**
 * What the compose box shows before anyone types: for each channel, may a message go out right now,
 * and if not, why in plain words. Runs the same gate as a real send but writes nothing.
 */
export async function getComposeState(
  ctx: TenantContextInput,
  contactId: string,
  opts: { now?: Date; gate?: OutboundGateOpts } = {}
): Promise<ChannelState[]> {
  const now = opts.now ?? new Date();
  const address = await contactAddress(ctx, contactId);
  const zone = await tenantZone(ctx);
  const states: ChannelState[] = [];
  for (const channel of ['sms', 'email'] as const) {
    const to = channel === 'sms' ? address.phone : address.email;
    if (!to) {
      states.push({ channel, canSend: false, message: describeBlock('no_address', channel) });
      continue;
    }
    const decision = await checkOutbound(
      ctx,
      { contactId, channel, module: 'crm', purpose: 'manual_message' },
      now,
      { ...opts.gate, audit: false }
    );
    if (!decision.allowed) {
      states.push({
        channel,
        canSend: false,
        message: describeBlock(decision.reason, channel, decision.retryAt, zone)
      });
      continue;
    }
    if (channel === 'email' && (await isEmailSuppressed(ctx.tenantId, to))) {
      states.push({ channel, canSend: false, message: describeBlock('email_suppressed', channel) });
      continue;
    }
    states.push({ channel, canSend: true, message: null });
  }
  return states;
}

export type ThreadMessage = {
  id: string;
  channel: 'sms' | 'email';
  direction: 'inbound' | 'outbound';
  subject: string | null;
  body: string;
  status: string;
  at: string;
};

/** The conversation with one contact, oldest first, last 50. Powers the reply view. */
export async function listContactThread(
  ctx: TenantContextInput,
  contactId: string,
  opts: { limit?: number } = {}
): Promise<ThreadMessage[]> {
  const parsed = uuidSchema.parse(contactId);
  const rows = await withTenant(ctx, (tx) =>
    tx
      .select({
        id: messages.id,
        channel: messages.channel,
        direction: messages.direction,
        subject: messages.subject,
        body: messages.body,
        status: messages.status,
        createdAt: messages.createdAt
      })
      .from(messages)
      .where(eq(messages.contactId, parsed))
      .orderBy(desc(messages.createdAt))
      .limit(opts.limit ?? 50)
  );
  return rows.toReversed().map((r) => ({
    id: r.id,
    channel: r.channel === 'email' ? 'email' : 'sms',
    direction: r.direction === 'inbound' ? 'inbound' : 'outbound',
    subject: r.subject,
    body: r.body,
    status: r.status,
    at: r.createdAt
  }));
}
