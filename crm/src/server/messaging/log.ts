import { and, desc, eq, lt, or, sql, type SQL } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { contacts, messages } from '../db/schema';
import { MESSAGING_MODULES, requireAnyModule } from '../modules';
import { withTenant } from '../tenancy';
import type { TenantContextInput } from '../tenancy';

// Messages log (F-30). Reads the rows the Twilio and Resend processors keep up to date, so a delivery
// callback shows here on the next load with no extra write path.

export const MESSAGE_STATUSES = [
  'queued',
  'sent',
  'delivered',
  'failed',
  'bounced',
  'complained',
  'received'
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

export const messageLogQuerySchema = z.object({
  channel: z.enum(['sms', 'email']).optional(),
  status: z.enum(MESSAGE_STATUSES).optional(),
  /** `<created_at>|<id>` of the last row on the previous page. */
  cursor: z
    .string()
    .regex(/^[^|]+\|[0-9a-f-]{36}$/i)
    .optional()
});
export type MessageLogQuery = z.infer<typeof messageLogQuerySchema>;

export type MessageLogRow = {
  id: string;
  channel: 'sms' | 'email';
  direction: 'inbound' | 'outbound';
  status: MessageStatus;
  contactId: string | null;
  contactName: string | null;
  fromAddress: string;
  toAddress: string;
  subject: string | null;
  preview: string;
  /** Provider error text for failed, bounced and complained rows; never a secret (set by the processors). */
  errorSummary: string | null;
  createdAt: string;
  deliveredAt: string | null;
};

export type MessageLogPage = { rows: MessageLogRow[]; nextCursor: string | null };

export const MESSAGE_LOG_PAGE_SIZE = 50;
const PREVIEW_CHARS = 120;
const ERROR_CHARS = 200;

function clip(text: string, max: number): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

function errorSummary(code: string | null, message: string | null): string | null {
  const text = [code, message && clip(message, ERROR_CHARS)].filter(Boolean).join(': ');
  return text || null;
}

/**
 * One page of the tenant's messages, newest first. Refuses when no messaging module is on (F-70).
 * Tenant isolation comes from the tenant context (RLS), not from a filter here.
 */
export async function listMessageLog(
  ctx: TenantContextInput,
  rawQuery: MessageLogQuery = {},
  opts: { db?: Db } = {}
): Promise<MessageLogPage> {
  const query = messageLogQuerySchema.parse(rawQuery);
  await requireAnyModule(ctx, MESSAGING_MODULES, opts);

  const conditions: (SQL | undefined)[] = [];
  if (query.channel) conditions.push(eq(messages.channel, query.channel));
  if (query.status) conditions.push(eq(messages.status, query.status));
  if (query.cursor) {
    const [at, id] = query.cursor.split('|') as [string, string];
    conditions.push(
      or(lt(messages.createdAt, at), and(eq(messages.createdAt, at), sql`${messages.id} < ${id}`))
    );
  }

  const rows = await withTenant(
    ctx,
    (tx) =>
      tx
        .select({
          id: messages.id,
          channel: messages.channel,
          direction: messages.direction,
          status: messages.status,
          contactId: messages.contactId,
          firstName: contacts.firstName,
          lastName: contacts.lastName,
          fromAddress: messages.fromAddress,
          toAddress: messages.toAddress,
          subject: messages.subject,
          body: messages.body,
          errorCode: messages.errorCode,
          errorMessage: messages.errorMessage,
          createdAt: messages.createdAt,
          deliveredAt: messages.deliveredAt
        })
        .from(messages)
        .leftJoin(
          contacts,
          and(eq(contacts.tenantId, messages.tenantId), eq(contacts.id, messages.contactId))
        )
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(desc(messages.createdAt), desc(messages.id))
        .limit(MESSAGE_LOG_PAGE_SIZE + 1),
    opts
  );

  const page = rows.slice(0, MESSAGE_LOG_PAGE_SIZE);
  const last = page[page.length - 1];
  return {
    rows: page.map((r) => ({
      id: r.id,
      channel: r.channel as MessageLogRow['channel'],
      direction: r.direction as MessageLogRow['direction'],
      status: r.status as MessageStatus,
      contactId: r.contactId,
      contactName:
        r.firstName === null ? null : [r.firstName, r.lastName].filter(Boolean).join(' ') || null,
      fromAddress: r.fromAddress,
      toAddress: r.toAddress,
      subject: r.subject,
      preview: clip(r.body, PREVIEW_CHARS),
      errorSummary: errorSummary(r.errorCode, r.errorMessage),
      createdAt: r.createdAt,
      deliveredAt: r.deliveredAt
    })),
    nextCursor: rows.length > MESSAGE_LOG_PAGE_SIZE && last ? `${last.createdAt}|${last.id}` : null
  };
}
