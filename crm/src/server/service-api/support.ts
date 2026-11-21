import { and, asc, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { notify } from '../notifications';
import type { Tx } from '../db/client';
import { memberships, supportRequestMessages, supportRequests } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { sanitizeSupportText } from '../support/service';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';

// Support requests for the service API (C11). Same rules as the portal: text is sanitized, the
// category defaults to general, the alert is in-app only, and a reply is not emailed.
//
// A service key has no user, but the support tables record an author and a submitter who must be
// users. Service writes are therefore attributed to the tenant's owner (the earliest owner
// membership). A tenant with no owner membership is refused with 403, since there is no one to
// attribute the write to.

const submitSchema = z.strictObject({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  category: z.enum(['general', 'alex_change', 'system_request']).default('general')
});
const replySchema = z.object({ body: z.string().trim().min(1).max(5000) });

const requestColumns = {
  id: supportRequests.id,
  subject: supportRequests.subject,
  body: supportRequests.body,
  category: supportRequests.category,
  status: supportRequests.status,
  createdAt: supportRequests.createdAt,
  updatedAt: supportRequests.updatedAt,
  resolvedAt: supportRequests.resolvedAt
};

/** Runs inside withServiceTenant. The tenant's owner, who service writes are attributed to. */
async function attributionUser(tx: Tx, svc: ServiceContext): Promise<string> {
  const [row] = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(and(eq(memberships.tenantId, svc.tenantId), eq(memberships.role, 'owner')))
    .orderBy(asc(memberships.createdAt))
    .limit(1);
  if (!row) throw new AppError('FORBIDDEN');
  return row.userId;
}

/** Runs inside withServiceTenant. Newest first, up to 100. */
export async function listServiceSupport(tx: Tx, svc: ServiceContext) {
  return tx
    .select(requestColumns)
    .from(supportRequests)
    .where(eq(supportRequests.tenantId, svc.tenantId))
    .orderBy(desc(supportRequests.createdAt))
    .limit(100);
}

/** Runs inside withServiceTenant. One request and its replies. A foreign or missing id is NOT_FOUND. */
export async function getServiceSupportThread(tx: Tx, svc: ServiceContext, rawId: string) {
  const id = parseInput(uuidSchema, rawId);
  const [row] = await tx
    .select(requestColumns)
    .from(supportRequests)
    .where(and(eq(supportRequests.id, id), eq(supportRequests.tenantId, svc.tenantId)))
    .limit(1);
  if (!row) throw new AppError('NOT_FOUND');
  const messages = await tx
    .select({
      id: supportRequestMessages.id,
      authorSide: supportRequestMessages.authorSide,
      body: supportRequestMessages.body,
      createdAt: supportRequestMessages.createdAt
    })
    .from(supportRequestMessages)
    .where(eq(supportRequestMessages.requestId, id))
    .orderBy(asc(supportRequestMessages.createdAt));
  return {
    ...row,
    messages: messages.map((m) => ({
      ...m,
      authorSide: m.authorSide === 'kynetic' ? ('kynetic' as const) : ('client' as const)
    }))
  };
}

/** Runs inside withServiceTenant. Stores the request and an in-app alert for Kynetic staff. */
export async function createServiceSupport(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>
) {
  const parsed = submitSchema.safeParse(body);
  if (!parsed.success) throw new ValidationError({ request: ['invalid'] });
  const subject = sanitizeSupportText(parsed.data.subject);
  const text = sanitizeSupportText(parsed.data.body);
  if (!subject || !text) throw new ValidationError({ request: ['invalid'] });
  const submittedBy = await attributionUser(tx, svc);
  const [row] = await tx
    .insert(supportRequests)
    .values({
      tenantId: svc.tenantId,
      subject,
      body: text,
      category: parsed.data.category,
      submittedBy
    })
    .returning({ id: supportRequests.id });
  await notify(
    tx,
    {
      type: 'support_request',
      title: 'New support request',
      body: subject,
      link: `/admin/support/${row!.id}`
    },
    { enqueueEmail: async () => undefined }
  );
  return { id: row!.id, category: parsed.data.category };
}

/** Runs inside withServiceTenant. A client-side reply. Nothing is emailed. */
export async function replyServiceSupport(
  tx: Tx,
  svc: ServiceContext,
  rawId: string,
  body: Record<string, unknown>
) {
  const id = parseInput(uuidSchema, rawId);
  const parsed = replySchema.safeParse({
    body: typeof body.body === 'string' ? sanitizeSupportText(body.body) : body.body
  });
  if (!parsed.success) throw new ValidationError({ body: ['invalid'] });
  const [request] = await tx
    .select({ id: supportRequests.id })
    .from(supportRequests)
    .where(and(eq(supportRequests.id, id), eq(supportRequests.tenantId, svc.tenantId)))
    .limit(1);
  if (!request) throw new AppError('NOT_FOUND');
  const authorUserId = await attributionUser(tx, svc);
  const [row] = await tx
    .insert(supportRequestMessages)
    .values({
      tenantId: svc.tenantId,
      requestId: id,
      authorUserId,
      authorSide: 'client',
      body: parsed.data.body
    })
    .returning({ id: supportRequestMessages.id });
  return { id: row!.id, requestId: id };
}
