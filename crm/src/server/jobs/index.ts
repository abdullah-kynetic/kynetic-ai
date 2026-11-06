import { sql, type SQL } from 'drizzle-orm';
import { PgBoss, type Db as IDatabase, type SendOptions } from 'pg-boss';
import type { Tx } from '../db/client';
import { getEnv } from '../env';
import { JOBS_SCHEMA, QUEUES, type QueueName } from './queues';

export { QUEUES, type QueueName };

export type JobContext = { jobId: string; retryCount: number };
export type JobHandler<T> = (data: T, job: JobContext) => Promise<void>;

type Role = 'app' | 'worker';
const boss: Partial<Record<Role, PgBoss>> = {};

/**
 * One pg-boss client per process and role. The web app enqueues as kynetic_app; the worker works
 * jobs as kynetic_worker. Neither runs migrations or maintenance (setupJobs does, as the owner).
 */
export async function getBoss(role: Role): Promise<PgBoss> {
  if (!boss[role]) {
    const env = getEnv();
    const url =
      role === 'worker' ? (env.DATABASE_URL_WORKER ?? env.DATABASE_URL) : env.DATABASE_URL;
    const b = new PgBoss({
      connectionString: url,
      schema: JOBS_SCHEMA,
      max: role === 'worker' ? 5 : 2,
      migrate: false,
      createSchema: false,
      supervise: role === 'worker',
      schedule: role === 'worker',
      registerInstance: false
    });
    b.on('error', (e) =>
      console.error(JSON.stringify({ level: 'error', msg: 'pg-boss', error: String(e) }))
    );
    await b.start();
    boss[role] = b;
  }
  return boss[role]!;
}

export async function scheduleRecurring(
  role: Role,
  queue: QueueName,
  cron: string,
  payload: object,
  key: string,
  tz?: string
): Promise<void> {
  const b = await getBoss(role);
  await b.schedule(queue, cron, payload, { key, ...(tz ? { tz } : {}) });
}

export async function stopJobs(): Promise<void> {
  for (const role of Object.keys(boss) as Role[]) {
    await boss[role]?.stop({ graceful: true, close: true });
    delete boss[role];
  }
}

/** Turns pg-boss's `$1`-style statement into a Drizzle query so it can run inside our transaction. */
function toDrizzle(text: string, values: unknown[] = []): SQL {
  const parts = text.split(/\$(\d+)/);
  const chunks: SQL[] = [];
  parts.forEach((part, i) => {
    chunks.push(i % 2 === 0 ? sql.raw(part) : sql`${values[Number(part) - 1] as never}`);
  });
  return sql.join(chunks, sql.raw(''));
}

/** Lets pg-boss write in the caller's transaction, so a job is queued only if the data commits. */
export function txAdapter(tx: Tx): IDatabase {
  return {
    executeSql: async (text, values) => {
      const rows = (await tx.execute(toDrizzle(text, values))) as unknown as Record<
        string,
        unknown
      >[];
      return { rows: Array.from(rows) };
    }
  };
}

export type EnqueueOptions = Omit<SendOptions, 'db'> & { tx?: Tx };

/**
 * Queues a job. With `tx`, the insert joins that transaction (the event contract: no separate
 * outbox). Returns the job id, or null when a singletonKey already holds the slot (a duplicate).
 */
export async function enqueue<T extends object>(
  queue: QueueName | (string & {}),
  payload: T,
  opts: EnqueueOptions = {}
): Promise<string | null> {
  const { tx, ...rest } = opts;
  const b = await getBoss('app');
  return b.send(queue, payload, tx ? { ...rest, db: txAdapter(tx) } : rest);
}

/**
 * Registers a handler on the worker. A thrown error fails the attempt; the queue's retry policy
 * (exponential backoff) decides what happens next. Log ids only, never payloads.
 */
export async function registerWorker<T extends object>(
  queue: QueueName | (string & {}),
  handler: JobHandler<T>,
  opts: { pollingIntervalSeconds?: number } = {}
): Promise<void> {
  const b = await getBoss('worker');
  await b.work<T>(
    queue,
    { batchSize: 1, pollingIntervalSeconds: opts.pollingIntervalSeconds ?? 2 },
    async ([job]) => {
      if (!job) return;
      try {
        await handler(job.data, { jobId: job.id, retryCount: job.retryCount });
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            msg: 'job failed',
            queue,
            jobId: job.id,
            retryCount: job.retryCount,
            error: error instanceof Error ? error.message : 'unknown'
          })
        );
        throw error;
      }
    }
  );
}
