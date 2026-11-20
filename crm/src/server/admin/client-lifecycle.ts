import { sql } from 'drizzle-orm';
import { withPlatform, type PlatformContext } from '../tenancy';
import { audit } from '../audit';
import { AppError } from '../errors';
import type { Db } from '../db/client';

export const LIFECYCLE_STAGES = ['onboarding', 'live', 'at_risk', 'churned', 'demo'] as const;
export type LifecycleStage = (typeof LIFECYCLE_STAGES)[number];

export function isLifecycleStage(value: string): value is LifecycleStage {
  return (LIFECYCLE_STAGES as readonly string[]).includes(value);
}

/** Stage shown before anyone has moved a card: derived from the tenant's status and demo flag. */
export function defaultLifecycleStage(input: {
  status: string;
  isDemo: boolean;
  healthTone?: 'green' | 'yellow' | 'red';
}): LifecycleStage {
  if (input.isDemo) return 'demo';
  if (input.status === 'offboarded') return 'churned';
  if (input.status === 'onboarding') return 'onboarding';
  return input.healthTone === 'red' ? 'at_risk' : 'live';
}

/** Saved stages by tenant id. Tenants without a saved stage are absent. */
export async function listClientLifecycle(
  ctx: PlatformContext,
  opts: { db?: Db } = {}
): Promise<Map<string, LifecycleStage>> {
  const rows = await withPlatform(
    ctx,
    (tx) => tx.execute(sql`select tenant_id, stage from admin_client_lifecycle_list()`),
    opts
  );
  const map = new Map<string, LifecycleStage>();
  for (const r of rows as unknown as { tenant_id: string; stage: string }[])
    if (isLifecycleStage(r.stage)) map.set(r.tenant_id, r.stage);
  return map;
}

/**
 * Saves a client's lifecycle stage and appends an audit row in the same transaction. Admin only;
 * the database function also refuses read-only sessions and the protected demo client.
 */
export async function moveClientLifecycle(
  ctx: PlatformContext,
  tenantId: string,
  stage: LifecycleStage,
  opts: { db?: Db; before?: LifecycleStage | null } = {}
): Promise<LifecycleStage> {
  if (!isLifecycleStage(stage))
    throw new AppError('VALIDATION_FAILED', { message: 'Unknown client stage.' });
  try {
    return await withPlatform(
      ctx,
      async (tx) => {
        const prior =
          opts.before === undefined
            ? ((
                Array.from(
                  await tx.execute<{ stage: string }>(
                    sql`select stage from admin_client_lifecycle_list() where tenant_id = ${tenantId}::uuid`
                  )
                )[0] as { stage: string } | undefined
              )?.stage ?? null)
            : opts.before;
        await tx.execute(sql`select admin_client_lifecycle_move(${tenantId}::uuid, ${stage})`);
        await audit(tx, {
          action: 'client_lifecycle.move',
          entity: 'client_lifecycle',
          entityId: tenantId,
          before: { stage: prior },
          after: { stage }
        });
        return stage;
      },
      opts
    );
  } catch (error) {
    const message = String(
      (error as { cause?: { message?: string }; message?: string })?.cause?.message ??
        (error as Error).message
    );
    if (message.includes('protected demo client'))
      throw new AppError('FORBIDDEN', {
        message: 'This demo client is protected and cannot be moved.'
      });
    if (message.includes('admin only') || message.includes('staff only'))
      throw new AppError('FORBIDDEN', { message: 'Only a Kynetic admin can move clients.' });
    if (message.includes('client not found'))
      throw new AppError('NOT_FOUND', { message: 'Client not found.' });
    throw error;
  }
}
