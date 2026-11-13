import { eq } from 'drizzle-orm';
import type { Actor } from '../auth/permissions';
import type { Db } from '../db/client';
import { importBatches } from '../db/schema';
import { AppError } from '../errors';
import { withTenant, type TenantContextInput } from '../tenancy';
import { canImportContacts } from './access';
import { commitContactBatch } from './commit';
import { commitEntityBatch, dryRunEntityBatch } from './entities';
import { dryRunContactBatch } from './dry-run';

type Options = { db?: Db };

async function entityFor(ctx: TenantContextInput, actor: Actor, batchId: string, opts: Options) {
  if (!canImportContacts(actor, ctx.tenantId)) throw new AppError('FORBIDDEN');
  return withTenant(
    ctx,
    async (tx) => {
      const [batch] = await tx
        .select({ entity: importBatches.entity })
        .from(importBatches)
        .where(eq(importBatches.id, batchId))
        .limit(1);
      if (!batch) throw new AppError('NOT_FOUND');
      return batch.entity;
    },
    opts
  );
}

export async function dryRunImportBatch(
  ctx: TenantContextInput,
  actor: Actor,
  batchId: string,
  mapping: unknown,
  opts: Options = {}
) {
  const entity = await entityFor(ctx, actor, batchId, opts);
  return entity === 'contact'
    ? dryRunContactBatch(ctx, actor, batchId, mapping, opts)
    : dryRunEntityBatch(ctx, actor, batchId, mapping, opts);
}

export async function commitImportBatch(
  ctx: TenantContextInput,
  actor: Actor,
  batchId: string,
  opts: Options = {}
) {
  const entity = await entityFor(ctx, actor, batchId, opts);
  return entity === 'contact'
    ? commitContactBatch(ctx, actor, batchId, opts)
    : commitEntityBatch(ctx, actor, batchId, opts);
}
