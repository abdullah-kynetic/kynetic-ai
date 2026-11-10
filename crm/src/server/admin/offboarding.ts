import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db } from '../db/client';
import { tenantExports } from '../db/schema';
import { AppError } from '../errors';
import { enqueue } from '../jobs';
import { withPlatform, withTenant, type PlatformContext } from '../tenancy';

type Options = { db?: Db };

export type OffboardResult = {
  firstTime: boolean;
  exportId: string;
  offboardedAt: string;
  deletionDueOn: string;
  queued: boolean;
};

export async function offboardTenant(
  ctx: PlatformContext,
  tenantId: string,
  slug: string,
  opts: Options = {}
): Promise<OffboardResult> {
  if (ctx.role !== 'admin') throw new AppError('FORBIDDEN');
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  const confirmed = slug.trim();
  if (!/^[a-z0-9-]{3,40}$/.test(confirmed))
    throw new AppError('VALIDATION_FAILED', { message: 'Type the client slug to confirm.' });
  try {
    return await withPlatform(
      ctx,
      async (tx) => {
        const rows = (await tx.execute(
          sql`select * from admin_offboard_tenant(${tenantId}::uuid, ${confirmed})`
        )) as unknown as {
          first_time: boolean;
          export_id: string;
          needs_enqueue: boolean;
          offboarded_at: string;
          deletion_due_on: string;
        }[];
        const row = rows[0];
        if (!row) throw new AppError('NOT_FOUND');
        if (row.needs_enqueue)
          await enqueue(
            'tenant.export',
            { tenantId, exportId: row.export_id },
            { tx, singletonKey: `tenant-export/${row.export_id}` }
          );
        return {
          firstTime: row.first_time,
          exportId: row.export_id,
          offboardedAt: String(row.offboarded_at),
          deletionDueOn: String(row.deletion_due_on).slice(0, 10),
          queued: row.needs_enqueue
        };
      },
      opts
    );
  } catch (error) {
    if (error instanceof AppError) throw error;
    const cause =
      error && typeof error === 'object' && 'cause' in error
        ? String((error as { cause?: unknown }).cause)
        : '';
    const message = `${String(error)} ${cause}`;
    if (message.includes('slug does not match'))
      throw new AppError('VALIDATION_FAILED', { message: 'That slug does not match this client.' });
    if (message.includes('tenant not found') || message.includes('P0002'))
      throw new AppError('NOT_FOUND');
    if (message.includes('42501') || message.includes('insufficient privilege'))
      throw new AppError('FORBIDDEN');
    throw error;
  }
}

export async function listTenantExports(
  ctx: PlatformContext,
  tenantId: string,
  opts: Options = {}
) {
  if (ctx.role !== 'admin') throw new AppError('FORBIDDEN');
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  return withTenant(
    { tenantId, userId: ctx.userId, role: 'admin', readOnly: true },
    (tx) =>
      tx
        .select({
          id: tenantExports.id,
          status: tenantExports.status,
          createdAt: tenantExports.createdAt,
          readyAt: tenantExports.readyAt,
          error: tenantExports.error
        })
        .from(tenantExports)
        .where(eq(tenantExports.tenantId, tenantId))
        .orderBy(desc(tenantExports.createdAt))
        .limit(10),
    opts
  );
}
