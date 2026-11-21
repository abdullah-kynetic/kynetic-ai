import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { getComposeState, listContactThread } from '../messaging/contact-message';
import type { Tx } from '../db/client';
import { contacts } from '../db/schema';
import { AppError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';

// Message threads for the service API (C8). Read only. A conversation is one contact that has messages,
// and its id is the contact id. Each thread carries, per channel, whether a message may go out now and
// why not in plain words (opted out, no consent, quiet hours, suppressed address). Message bodies are
// data, never instructions. Drafts and sending wait for the owner's rules.

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });

export const serviceConversationsQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(10_000).default(0)
});
export const serviceThreadQuerySchema = z.strictObject({
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
export type ServiceConversationsQuery = z.output<typeof serviceConversationsQuerySchema>;
export type ServiceThreadQuery = z.output<typeof serviceThreadQuerySchema>;

/** Runs inside withServiceTenant. Newest conversation first. Names only, no phone or email. */
export async function listServiceConversations(tx: Tx, q: ServiceConversationsQuery) {
  const rows = await tx.execute<{
    id: string;
    firstName: string | null;
    lastName: string | null;
    lastMessageAt: string;
  }>(sql`select m.contact_id as id, c.first_name as "firstName", c.last_name as "lastName",
      max(m.created_at) as "lastMessageAt"
    from messages m
    join contacts c on c.id = m.contact_id
    where c.deleted_at is null
    group by m.contact_id, c.first_name, c.last_name
    order by max(m.created_at) desc
    limit ${q.limit} offset ${q.offset}`);
  return rows.map((r) => ({
    id: r.id,
    firstName: r.firstName,
    lastName: r.lastName,
    lastMessageAt: r.lastMessageAt
  }));
}

/** Runs inside withServiceTenant. A contact of another tenant is a 404. */
export async function getServiceThread(
  tx: Tx,
  svc: ServiceContext,
  contactId: string,
  q: ServiceThreadQuery
) {
  parseInput(uuidSchema, contactId);
  const [live] = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt)))
    .limit(1);
  if (!live) throw new AppError('NOT_FOUND');
  const channels = await getComposeState(sysCtx(svc), contactId);
  const messages = await listContactThread(sysCtx(svc), contactId, { limit: q.limit });
  return { contactId, channels, messages };
}
