import { and, isNotNull, lt, or, sql } from 'drizzle-orm';
import { getStorage, keyBelongsToTenant, type StorageAdapter } from '../adapters/storage';
import { audit } from '../audit';
import { getWorkerDb, type Db } from '../db/client';
import { calls, importBatches, messages } from '../db/schema';
import { registerWorker, scheduleRecurring } from '../jobs';
import { listRetentionTenants } from '../schedules';
import { withSystem, withTenant } from '../tenancy';

export const RETENTION_CRON = '30 4 * * *';
const DAY_MS = 86_400_000;

export function retentionCutoffs(now: Date) {
  const messagesBefore = new Date(now);
  messagesBefore.setUTCMonth(messagesBefore.getUTCMonth() - 24);
  const consentsBefore = new Date(now);
  consentsBefore.setUTCMonth(consentsBefore.getUTCMonth() - 60);
  return {
    messagesBefore,
    consentsBefore,
    importsBefore: new Date(now.getTime() - 30 * DAY_MS),
    webhooksBefore: new Date(now.getTime() - 30 * DAY_MS)
  };
}

export type RetentionCounts = {
  callsCleared: number;
  messagesDeleted: number;
  consentsDeleted: number;
  importFilesDeleted: number;
  webhookPayloadsCleared: number;
};

async function purgeTenant(
  tenantId: string,
  now: Date,
  opts: { db?: Db }
): Promise<Omit<RetentionCounts, 'webhookPayloadsCleared'>> {
  const cutoff = retentionCutoffs(now);
  const db = opts.db ?? getWorkerDb();
  return withTenant(
    { tenantId, role: 'system' },
    async (tx) => {
      const dueCalls = await tx
        .select({
          id: calls.id,
          recordingKey: calls.recordingKey
        })
        .from(calls)
        .where(
          and(
            isNotNull(calls.purgeAfter),
            lt(calls.purgeAfter, now.toISOString()),
            or(
              isNotNull(calls.recordingKey),
              isNotNull(calls.recordingProviderUrl),
              isNotNull(calls.transcript),
              isNotNull(calls.transcriptSegments)
            )
          )
        );
      let storage: StorageAdapter | null = null;
      const removeKey = async (key: string | null) => {
        if (!key || !keyBelongsToTenant(tenantId, key)) return;
        storage ??= getStorage();
        await storage.remove(key);
      };
      for (const call of dueCalls) await removeKey(call.recordingKey);
      if (dueCalls.length) {
        await tx
          .update(calls)
          .set({
            recordingKey: null,
            recordingProviderUrl: null,
            transcript: null,
            transcriptSegments: null,
            updatedAt: now.toISOString()
          })
          .where(and(isNotNull(calls.purgeAfter), lt(calls.purgeAfter, now.toISOString())));
      }

      const removedMessages = await tx
        .delete(messages)
        .where(lt(messages.createdAt, cutoff.messagesBefore.toISOString()))
        .returning({ id: messages.id });

      const consentRows = await tx.execute<{ purge_expired_consents: number }>(
        sql`select purge_expired_consents(${tenantId}::uuid, ${cutoff.consentsBefore.toISOString()}::timestamptz)`
      );
      const consentsDeleted = Number(consentRows[0]?.purge_expired_consents ?? 0);

      const dueFiles = await tx
        .select({ id: importBatches.id, fileKey: importBatches.fileKey })
        .from(importBatches)
        .where(
          and(
            isNotNull(importBatches.committedAt),
            lt(importBatches.committedAt, cutoff.importsBefore.toISOString()),
            isNotNull(importBatches.fileKey)
          )
        );
      for (const file of dueFiles) await removeKey(file.fileKey);
      if (dueFiles.length) {
        await tx
          .update(importBatches)
          .set({ fileKey: null })
          .where(
            and(
              isNotNull(importBatches.committedAt),
              lt(importBatches.committedAt, cutoff.importsBefore.toISOString()),
              isNotNull(importBatches.fileKey)
            )
          );
      }

      const counts = {
        callsCleared: dueCalls.length,
        messagesDeleted: removedMessages.length,
        consentsDeleted,
        importFilesDeleted: dueFiles.length
      };
      if (Object.values(counts).some((count) => count > 0)) {
        await audit(tx, {
          action: 'retention.purge',
          entity: 'tenant',
          entityId: tenantId,
          after: counts
        });
      }
      return counts;
    },
    { db }
  );
}

async function purgeWebhookPayloads(now: Date, opts: { db?: Db }): Promise<number> {
  const cutoff = retentionCutoffs(now).webhooksBefore.toISOString();
  const db = opts.db ?? getWorkerDb();
  return withSystem(
    async (tx) => {
      const rows = await tx.execute<{ n: number }>(sql`
      with updated as (
        update webhook_events
        set payload = '{}'::jsonb,
            processed_at = coalesce(processed_at, now()),
            last_error = case when processed_at is null then 'retention_purged' else last_error end
        where received_at < ${cutoff}::timestamptz
          and payload <> '{}'::jsonb
        returning 1
      )
      select count(*)::int as n from updated
    `);
      const cleared = Number(rows[0]?.n ?? 0);
      if (cleared > 0) {
        await audit(tx, {
          action: 'retention.webhook_payload',
          entity: 'webhook_event',
          after: { cleared }
        });
      }
      return cleared;
    },
    { db }
  );
}

/** Idempotent. A second run in the same window finds nothing left to clear. */
export async function runRetentionPurge(
  opts: { db?: Db; now?: Date } = {}
): Promise<RetentionCounts> {
  const now = opts.now ?? new Date();
  const totals: RetentionCounts = {
    callsCleared: 0,
    messagesDeleted: 0,
    consentsDeleted: 0,
    importFilesDeleted: 0,
    webhookPayloadsCleared: 0
  };
  for (const tenant of await listRetentionTenants(opts)) {
    const counts = await purgeTenant(tenant.tenantId, now, opts);
    totals.callsCleared += counts.callsCleared;
    totals.messagesDeleted += counts.messagesDeleted;
    totals.consentsDeleted += counts.consentsDeleted;
    totals.importFilesDeleted += counts.importFilesDeleted;
  }
  totals.webhookPayloadsCleared = await purgeWebhookPayloads(now, opts);
  return totals;
}

export async function registerRetentionWorker(): Promise<void> {
  await registerWorker('retention.purge', async () => {
    await runRetentionPurge();
  });
}

export async function scheduleRetentionPurge(): Promise<void> {
  await scheduleRecurring('worker', 'retention.purge', RETENTION_CRON, {}, 'retention-purge-daily');
}
