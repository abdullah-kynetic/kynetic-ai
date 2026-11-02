import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { authorize, type Actor } from '../auth';
import { audit } from '../audit';
import type { Db } from '../db/client';
import { supportRequests } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { withPlatform, withTenant, type TenantContextInput } from '../tenancy';

export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

const submitSchema = z.strictObject({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(5000)
});
const statusSchema = z.enum(SUPPORT_STATUSES);
type Options = { db?: Db };
type StaffContext = { userId: string; role: 'admin' | 'va' };

export type SupportRequestRow = {
  id: string;
  subject: string;
  body: string;
  status: SupportStatus;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
};
export type SupportQueueRow = SupportRequestRow & { tenantId: string; tenantName: string };

/** A client user files a request for their own tenant. Nothing is sent; staff see it in the queue. */
export async function submitSupportRequest(
  ctx: TenantContextInput,
  actor: Actor,
  input: unknown,
  opts: Options = {}
): Promise<{ id: string }> {
  authorize(actor, 'tenant_data.write', ctx.tenantId);
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) throw new ValidationError({ request: ['invalid'] });
  return withTenant(
    ctx,
    async (tx) => {
      const [row] = await tx
        .insert(supportRequests)
        .values({
          tenantId: ctx.tenantId,
          subject: parsed.data.subject,
          body: parsed.data.body,
          submittedBy: actor.userId
        })
        .returning({ id: supportRequests.id });
      await audit(tx, {
        action: 'support.submit',
        entity: 'support_request',
        entityId: row!.id,
        after: { subjectLength: parsed.data.subject.length }
      });
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
          status: supportRequests.status,
          createdAt: supportRequests.createdAt,
          updatedAt: supportRequests.updatedAt,
          resolvedAt: supportRequests.resolvedAt
        })
        .from(supportRequests)
        .where(eq(supportRequests.tenantId, ctx.tenantId))
        .orderBy(desc(supportRequests.createdAt))
        .limit(100);
      return rows.map((row) => ({ ...row, status: statusSchema.parse(row.status) }));
    },
    opts
  );
}

/** Kynetic staff: open requests first, across every client. The database function checks the role. */
export async function listSupportQueue(
  ctx: StaffContext,
  opts: Options = {}
): Promise<SupportQueueRow[]> {
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select * from admin_list_support_requests()`),
    opts
  );
  return (rows as unknown as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    tenantId: String(row.tenant_id),
    tenantName: String(row.tenant_name),
    subject: String(row.subject),
    body: String(row.body),
    status: statusSchema.parse(row.status),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    updatedAt: new Date(row.updated_at as string | Date).toISOString(),
    resolvedAt: row.resolved_at ? new Date(row.resolved_at as string | Date).toISOString() : null
  }));
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
