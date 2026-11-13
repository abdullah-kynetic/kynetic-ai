import { sql } from 'drizzle-orm';
import { buildCommit } from './build-info';
import type { Db } from './db/client';

export const WORKER_HEARTBEAT_NAME = 'worker';
/** The worker beats this often. */
export const WORKER_HEARTBEAT_INTERVAL_MS = 30_000;
/** /api/health reports 503 when the last beat is older than this (six missed beats). */
export const WORKER_HEARTBEAT_MAX_AGE_S = 180;

/** beat_at comes from the database clock, so container clock skew cannot fake a live worker. */
export async function writeWorkerHeartbeat(db: Db, commit = buildCommit()): Promise<void> {
  await db.execute(sql`
    INSERT INTO worker_heartbeats (name, beat_at, commit_sha)
    VALUES (${WORKER_HEARTBEAT_NAME}, now(), ${commit})
    ON CONFLICT (name) DO UPDATE SET beat_at = now(), commit_sha = EXCLUDED.commit_sha`);
}

/**
 * Beats now and then on an interval. A failed beat is logged and retried next tick; it never stops
 * the worker. Returns a stop function.
 */
export function startWorkerHeartbeat(
  db: Db,
  opts: { intervalMs?: number; commit?: string } = {}
): () => void {
  const beat = () =>
    writeWorkerHeartbeat(db, opts.commit).catch((e) =>
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'worker heartbeat failed',
          error: e instanceof Error ? e.message : 'unknown'
        })
      )
    );
  void beat();
  const timer = setInterval(beat, opts.intervalMs ?? WORKER_HEARTBEAT_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}

export type WorkerStatus = 'ok' | 'stale' | 'missing';

/** `ageSeconds` null means no heartbeat row (or none readable). */
export function workerStatus(ageSeconds: number | null): WorkerStatus {
  if (ageSeconds === null) return 'missing';
  return ageSeconds > WORKER_HEARTBEAT_MAX_AGE_S ? 'stale' : 'ok';
}
