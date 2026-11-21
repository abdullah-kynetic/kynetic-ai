import { authorize, type Actor } from '../auth';
import { mintSignedUrl, type StorageAdapter } from '../adapters/storage';
import type { Tx } from '../db/client';
import { calls } from '../db/schema';
import { AppError } from '../errors';
import { requireModule } from '../modules';
import { withTenant, type TenantContextInput } from '../tenancy';
import { eq } from 'drizzle-orm';

/**
 * The only way to reach a call recording (F-27): permission and module checks, a tenant-scoped read
 * (another tenant's call is a 404), then a five-minute signed URL. The object key is never returned.
 */
export async function getCallRecordingUrl(
  actor: Actor,
  ctx: TenantContextInput,
  callId: string,
  storage: StorageAdapter
): Promise<{ url: string }> {
  authorize(actor, 'calls.read', ctx.tenantId);
  return getCallRecordingUrlFor(ctx, callId, storage);
}

/** Runs after the caller's permission check. The service API uses this with its token scope as the check. */
export async function getCallRecordingUrlFor(
  ctx: TenantContextInput,
  callId: string,
  storage: StorageAdapter,
  opts: { tx?: Tx } = {}
): Promise<{ url: string }> {
  await requireModule(ctx, 'alex_core', opts);
  const read = async (tx: Tx) => {
    const [row] = await tx
      .select({ recordingKey: calls.recordingKey })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);
    return row?.recordingKey ?? null;
  };
  const key = opts.tx ? await read(opts.tx) : await withTenant(ctx, read);
  if (!key) throw new AppError('NOT_FOUND');
  return { url: await mintSignedUrl(storage, ctx.tenantId, key) };
}
