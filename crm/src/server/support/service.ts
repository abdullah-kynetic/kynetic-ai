import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authorize, type Actor } from '../auth';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { supportRequestMessages, supportRequests } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { enqueueSupportReplyEmail, notify, type EnqueueEmail } from '../notifications';
import { withPlatform, withTenant, type TenantContextInput } from '../tenancy';

export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];
export const SUPPORT_CATEGORIES = ['general', 'alex_change', 'system_request'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

const submitSchema = z.strictObject({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000),
  category: z.enum(SUPPORT_CATEGORIES).default('general')
});
const statusSchema = z.enum(SUPPORT_STATUSES);
const categorySchema = z.enum(SUPPORT_CATEGORIES);
const replySchema = z.string().trim().min(1).max(5000);
type Options = { db?: Db };
type StaffContext = { userId: string; role: 'admin' | 'va' };

/** Plain text only. Angle brackets and control characters are dropped so a message cannot carry markup. */
export function sanitizeSupportText(value: string): string {
  let out = '';
  for (const char of value) {
    const code = char.charCodeAt(0);
    if ((code < 32 && code !== 9 && code !== 10 && code !== 13) || code === 127) continue;
    if (char === '<' || char === '>') continue;
    out += char;
  }
  return out.trim();
}

export type SupportMessage = {
  id: string;
  authorUserId: string;
  authorSide: 'client' | 'kynetic';
  body: string;
  createdAt: string;
};

export type SupportRequestRow = {
  id: string;
  subject: string;
  body: string;
  category: SupportCategory;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};
export type SupportQueueRow = SupportRequestRow & {
  tenantId: string;
  tenantName: string;
  submittedBy: string;
};
export type SupportThread = SupportRequestRow & { messages: SupportMessage[] };
export type StaffThread = SupportQueueRow & { messages: SupportMessage[] };

const inAppOnly: EnqueueEmail = async () => undefined;

function denyQuietViewAs(actor: Actor): boolean {
  return Boolean(actor.viewAs && !actor.viewAs.write);
}

/** A client user files a request for their own tenant. The alert is in-app only. */
export async function submitSupportRequest(
  ctx: TenantContextInput,
  actor: Actor,
  input: unknown,
  opts: Options = {}
): Promise<{ id: string }> {
  if (denyQuietViewAs(actor)) {
    await withTenant(
      ctx,
      (tx) =>
        audit(tx, {
          action: 'viewas.write_denied',
          entity: 'support_request'
        }),
      opts
    );
    throw new AppError('FORBIDDEN');
  }
  authorize(actor, 'tenant_data.write', ctx.tenantId);
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ request: ['invalid'] });
  const body = sanitizeSupportText(parsed.data.body);
  const subject = sanitizeSupportText(parsed.data.subject);
  if (!body || !subject || body.length > 5000 || subject.length > 200)
    throw new ValidationError({ request: ['invalid'] });
  return withTenant(
    ctx,
    async (tx) => {
      const [row] = await tx
        .insert(supportRequests)
        .values({
          tenantId: ctx.tenantId,
          subject,
          body,
          category: parsed.data.category,
          submittedBy: actor.userId
        })
        .returning({ id: supportRequests.id });
      await audit(tx, {
        action: 'support.submit',
        entity: 'support_request',
        entityId: row!.id,
        after: { subjectLength: subject.length, category: parsed.data.category }
      });
      await notify(
        tx,
        {
          type: 'support_request',
          title: 'New support request',
          body: subject,
          link: `/admin/support/${row!.id}`
        },
        { enqueueEmail: inAppOnly }
      );
      return { id: row!.id };
    },
    opts
  );
}

/** A client user's own tenant's requests, newest first. */
export async function listOwnSupportRequests(
  ctx: TenantContextInput,
  actor: Actor,
  opts: Options = {}
): Promise<SupportRequestRow[]> {
  authorize(actor, 'tenant_data.read', ctx.tenantId);
  return withTenant(
    ctx,
    async (tx) => {
      const rows = await tx
        .select({
          id: supportRequests.id,
          subject: supportRequests.subject,
          body: supportRequests.body,
          category: supportRequests.category,
          status: supportRequests.status,
          createdAt: supportRequests.createdAt,
          updatedAt: supportRequests.updatedAt,
          resolvedAt: supportRequests.resolvedAt
        })
        .from(supportRequests)
        .where(eq(supportRequests.tenantId, ctx.tenantId))
        .orderBy(desc(supportRequests.createdAt))
        .limit(100);
      return rows.map((row) => ({
        ...row,
        status: statusSchema.parse(row.status),
        category: categorySchema.parse(row.category)
      }));
    },
    opts
  );
}

async function ownMessages(tx: Parameters<Parameters<typeof withTenant>[1]>[0], requestId: string) {
  const rows = await tx
    .select({
      id: supportRequestMessages.id,
      authorUserId: supportRequestMessages.authorUserId,
      authorSide: supportRequestMessages.authorSide,
      body: supportRequestMessages.body,
      createdAt: supportRequestMessages.createdAt
    })
    .from(supportRequestMessages)
    .where(eq(supportRequestMessages.requestId, requestId))
    .orderBy(asc(supportRequestMessages.createdAt));
  return rows.map((row) => ({
    ...row,
    authorSide: row.authorSide === 'kynetic' ? ('kynetic' as const) : ('client' as const)
  }));
}

/** One request and its replies, or null when it is not in this tenant. */
export async function getOwnSupportThread(
  ctx: TenantContextInput,
  actor: Actor,
  requestId: string,
  opts: Options = {}
): Promise<SupportThread | null> {
  authorize(actor, 'tenant_data.read', ctx.tenantId);
  if (!z.string().uuid().safeParse(requestId).success) return null;
  return withTenant(
    ctx,
    async (tx) => {
      const [row] = await tx
        .select({
          id: supportRequests.id,
          subject: supportRequests.subject,
          body: supportRequests.body,
          category: supportRequests.category,
          status: supportRequests.status,
          createdAt: supportRequests.createdAt,
          updatedAt: supportRequests.updatedAt,
          resolvedAt: supportRequests.resolvedAt
        })
        .from(supportRequests)
        .where(and(eq(supportRequests.id, requestId), eq(supportRequests.tenantId, ctx.tenantId)))
        .limit(1);
      if (!row) return null;
      return {
        ...row,
        status: statusSchema.parse(row.status),
        category: categorySchema.parse(row.category),
        messages: await ownMessages(tx, requestId)
      };
    },
    opts
  );
}

/** A client adds a reply. Nothing is emailed. */
export async function replyToOwnSupportRequest(
  ctx: TenantContextInput,
  actor: Actor,
  requestId: string,
  body: unknown,
  opts: Options = {}
): Promise<{ id: string }> {
  if (denyQuietViewAs(actor)) {
    await withTenant(
      ctx,
      (tx) =>
        audit(tx, {
          action: 'viewas.write_denied',
          entity: 'support_request',
          entityId: z.string().uuid().safeParse(requestId).success ? requestId : undefined
        }),
      opts
    );
    throw new AppError('FORBIDDEN');
  }
  authorize(actor, 'tenant_data.write', ctx.tenantId);
  const parsed = replySchema.safeParse(typeof body === 'string' ? sanitizeSupportText(body) : body);
  if (!parsed.success || !z.string().uuid().safeParse(requestId).success)
    throw new ValidationError({ body: ['invalid'] });
  return withTenant(
    ctx,
    async (tx) => {
      const [request] = await tx
        .select({ id: supportRequests.id })
        .from(supportRequests)
        .where(and(eq(supportRequests.id, requestId), eq(supportRequests.tenantId, ctx.tenantId)))
        .limit(1);
      if (!request) throw new AppError('NOT_FOUND');
      const [row] = await tx
        .insert(supportRequestMessages)
        .values({
          tenantId: ctx.tenantId,
          requestId,
          authorUserId: actor.userId,
          authorSide: 'client',
          body: parsed.data
        })
        .returning({ id: supportRequestMessages.id });
      await audit(tx, {
        action: 'support.reply',
        entity: 'support_request',
        entityId: requestId,
        after: { side: 'client', messageId: row!.id }
      });
      return { id: row!.id };
    },
    opts
  );
}

function mapQueue(row: Record<string, unknown>): SupportQueueRow {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    tenantName: String(row.tenant_name),
    submittedBy: String(row.submitted_by),
    subject: String(row.subject),
    body: String(row.body),
    category: categorySchema.parse(row.category),
    status: statusSchema.parse(row.status),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at as string | Date).toISOString() : null
  };
}

/** Kynetic staff: requests across every client. Pass a category or status to filter. */
export async function listSupportQueue(
  ctx: StaffContext,
  opts: Options & { category?: SupportCategory | null; status?: SupportStatus | null } = {}
): Promise<SupportQueueRow[]> {
  const category = opts.category ?? null;
  const status = opts.status ?? null;
  if (category && !categorySchema.safeParse(category).success)
    throw new ValidationError({ category: ['invalid'] });
  if (status && !statusSchema.safeParse(status).success)
    throw new ValidationError({ status: ['invalid'] });
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select * from admin_list_support_requests(${category})`),
    opts
  );
  const queue = (rows as unknown as Record<string, unknown>[]).map(mapQueue);
  return status ? queue.filter((row) => row.status === status) : queue;
}

export type SupportAlert = {
  id: string;
  tenantId: string;
  tenantName: string;
  title: string;
  body: string | null;
  link: string | null;
  createdAt: string;
};

/** Unread in-app alerts for new client requests. Email is not sent. */
export async function listSupportAlerts(
  ctx: StaffContext,
  opts: Options = {}
): Promise<SupportAlert[]> {
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select * from admin_list_support_alerts()`),
    opts
  );
  return (rows as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    tenantName: String(row.tenant_name),
    title: String(row.title),
    body: row.body ? String(row.body) : null,
    link: row.link ? String(row.link) : null,
    createdAt: new Date(row.created_at as string | Date).toISOString()
  }));
}

function mapMessages(value: unknown): SupportMessage[] {
  const rows = Array.isArray(value) ? value : [];
  return rows.map((row) => {
    const message = row as Record<string, unknown>;
    return {
      id: String(message.id),
      authorUserId: String(message.authorUserId),
      authorSide: message.authorSide === 'kynetic' ? 'kynetic' : 'client',
      body: String(message.body),
      createdAt: new Date(message.createdAt as string | Date).toISOString()
    };
  });
}

/** Staff open one thread. The read is audited. Null when the id does not exist. */
export async function getStaffSupportThread(
  ctx: StaffContext,
  requestId: string,
  opts: Options = {}
): Promise<StaffThread | null> {
  if (!z.string().uuid().safeParse(requestId).success) return null;
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select * from admin_get_support_thread(${requestId}::uuid)`),
    opts
  );
  const row = (rows as unknown as Record<string, unknown>[])[0];
  if (!row) return null;
  return { ...mapQueue(row), messages: mapMessages(row.messages) };
}

/** Kynetic staff reply. The requester gets an in-app notification and no email. */
export async function replyAsStaff(
  ctx: StaffContext,
  requestId: string,
  body: unknown,
  opts: Options = {}
): Promise<{ id: string }> {
  const text = sanitizeSupportText(typeof body === 'string' ? body : '');
  if (!replySchema.safeParse(text).success || !z.string().uuid().safeParse(requestId).success)
    throw new ValidationError({ body: ['invalid'] });
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select * from admin_reply_support_request(${requestId}::uuid, ${text})`),
    opts
  );
  const row = (rows as unknown as Record<string, unknown>[])[0];
  if (!row?.message_id) throw new AppError('NOT_FOUND');
  const tenantId = String(row.tenant_id);
  const submittedBy = String(row.submitted_by);
  await withTenant(
    { tenantId, userId: ctx.userId, role: ctx.role },
    (tx) =>
      notify(
        tx,
        {
          userId: submittedBy,
          type: 'support_reply',
          title: 'Kynetic replied',
          body: text.slice(0, 240),
          link: `/dashboard/support/${requestId}`
        },
        { enqueueEmail: enqueueSupportReplyEmail }
      ),
    opts
  );
  return { id: String(row.message_id) };
}

/** Kynetic staff change a request's status; the change is audited inside the database function. */
export async function setSupportRequestStatus(
  ctx: StaffContext,
  requestId: string,
  status: unknown,
  opts: Options = {}
): Promise<{ status: SupportStatus }> {
  const parsed = statusSchema.safeParse(status);
  if (!parsed.success || !z.string().uuid().safeParse(requestId).success)
    throw new ValidationError({ status: ['invalid'] });
  const rows = await withPlatform(
    ctx,
    (tx) =>
      tx.execute(
        sql`select admin_set_support_request_status(${requestId}::uuid, ${parsed.data}) as changed`
      ),
    opts
  );
  if (!(rows as unknown as { changed: boolean }[])[0]?.changed) throw new AppError('NOT_FOUND');
  return { status: parsed.data };
}
