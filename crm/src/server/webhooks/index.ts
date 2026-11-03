import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb, getWorkerDb, type Db } from '../db/client';
import { webhookEvents } from '../db/schema';
import { enqueue, registerWorker } from '../jobs';

// ARCHITECTURE section 3 "Inbound webhook" (F-77). The route verifies the signature, then calls
// ingestWebhook; a replay stores nothing and queues nothing, and the route still answers 200.

export class WebhookSignatureError extends Error {
  readonly code = 'UNAUTHENTICATED';
  readonly status = 401;
  constructor() {
    super('Webhook signature could not be verified');
    this.name = 'WebhookSignatureError';
  }
}

export type IngestInput = {
  source: string;
  externalId: string;
  /** Known at intake from the path key, otherwise resolved by the processor. */
  tenantId?: string;
  payload: unknown;
  /** Must return true for a valid signature. Runs before anything is stored. */
  verify: () => boolean | Promise<boolean>;
};

function isUniqueViolation(e: unknown): boolean {
  const code = e as { code?: string; cause?: { code?: string } } | null;
  return code?.code === '23505' || code?.cause?.code === '23505';
}

/**
 * Verifies, stores the event once, and queues its processing in the same transaction.
 * Returns `duplicate` for a replay (same source and external id). The app role may only INSERT into
 * webhook_events, so the unique violation, not a SELECT, is how a replay is detected.
 */
export async function ingestWebhook(
  input: IngestInput,
  opts: { db?: Db } = {}
): Promise<{ status: 'accepted' | 'duplicate'; id?: string }> {
  if (!(await input.verify())) throw new WebhookSignatureError();
  const db = opts.db ?? getDb();
  const id = randomUUID();
  try {
    await db.transaction(async (tx) => {
      await tx.insert(webhookEvents).values({
        id,
        source: input.source,
        externalId: input.externalId,
        tenantId: input.tenantId ?? null,
        payload: input.payload as never
      });
      await enqueue('webhook.process', { webhookEventId: id, source: input.source }, { tx });
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { status: 'duplicate' };
    throw e;
  }
  return { status: 'accepted', id };
}

export type WebhookProcessor = (event: {
  id: string;
  source: string;
  externalId: string;
  tenantId: string | null;
  payload: unknown;
}) => Promise<void>;

const processors = new Map<string, WebhookProcessor>();

/** Registers the processor for one webhook source in the worker process. */
export function registerWebhookProcessor(source: string, fn: WebhookProcessor): void {
  if (processors.has(source)) throw new Error(`A processor for ${source} is already registered`);
  processors.set(source, fn);
}

export function clearWebhookProcessors(): void {
  processors.clear();
}

/**
 * Runs one stored event. Skips an event already processed (a job redelivered after success), records
 * attempts and the last error on failure, and rethrows so the queue retries with backoff.
 */
export async function processWebhookEvent(
  id: string,
  opts: { db?: Db } = {}
): Promise<'processed' | 'already_processed'> {
  const db = opts.db ?? getWorkerDb();
  const [row] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, id)).limit(1);
  if (!row) throw new Error(`webhook_events row ${id} not found`);
  if (row.processedAt) return 'already_processed';
  const processor = processors.get(row.source);
  if (!processor) throw new Error(`No processor registered for webhook source ${row.source}`);
  try {
    await processor({
      id: row.id,
      source: row.source,
      externalId: row.externalId,
      tenantId: row.tenantId,
      payload: row.payload
    });
  } catch (e) {
    await db
      .update(webhookEvents)
      .set({
        attempts: row.attempts + 1,
        lastError: e instanceof Error ? e.message.slice(0, 500) : 'unknown error'
      })
      .where(eq(webhookEvents.id, id));
    throw e;
  }
  await db
    .update(webhookEvents)
    .set({ processedAt: new Date().toISOString(), lastError: null })
    .where(eq(webhookEvents.id, id));
  return 'processed';
}

export async function registerWebhookWorker(
  opts: { pollingIntervalSeconds?: number } = {}
): Promise<void> {
  await registerWorker<{ webhookEventId: string }>(
    'webhook.process',
    async ({ webhookEventId }) => {
      await processWebhookEvent(webhookEventId);
    },
    opts
  );
}
