import { authorize, type Actor } from '../auth';
import { mintSignedUrl, type StorageAdapter } from '../adapters/storage';
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
  await requireModule(ctx, 'alex_core');
  const key = await withTenant(ctx, async (tx) => {
    const [row] = await tx
      .select({ recordingKey: calls.recordingKey })
      .from(calls)
      .where(eq(calls.id, callId))
      .limit(1);
    return row?.recordingKey ?? null;
  });
  if (!key) throw new AppError('NOT_FOUND');
  return { url: await mintSignedUrl(storage, ctx.tenantId, key) };
}
