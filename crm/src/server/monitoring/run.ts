import { statfs } from 'node:fs/promises';
import { sql } from 'drizzle-orm';
import type { EmailProvider } from '../adapters/email';
import { emailAdmins } from '../admin/alerts';
import { getWorkerDb, type Db } from '../db/client';
import { withSystem } from '../tenancy';
import { alertDedupeKey, evaluateRules, type Alert, type MonitoringFacts } from './rules';

async function readDiskUsedPercent(path: string): Promise<number | null> {
  try {
    const s = await statfs(path);
    if (!s.blocks) return null;
    return ((s.blocks - s.bavail) / s.blocks) * 100;
  } catch {
    return null;
  }
}

/** Reads each fact on its own, so one unreadable table never hides the other rules. */
export async function collectFacts(
  opts: { db?: Db; diskPath?: string } = {}
): Promise<MonitoringFacts> {
  const db = opts.db ?? getWorkerDb();
  const safe = async <T>(run: () => Promise<T>, fallback: T): Promise<T> => {
    try {
      return await run();
    } catch {
      return fallback;
    }
  };

  const workerAgeSeconds = await safe(async () => {
    const rows = (await db.execute(
      sql`select extract(epoch from (now() - beat_at))::float8 as age from worker_heartbeats where name = 'worker'`
    )) as unknown as { age: number }[];
    return rows[0] ? Number(rows[0].age) : null;
  }, null);

  const failedJobsLast15Min = await safe(async () => {
    const rows = (await db.execute(
      sql`select count(*)::int as n from pgboss.job where state = 'failed' and completed_on > now() - interval '15 minutes'`
    )) as unknown as { n: number }[];
    return Number(rows[0]?.n ?? 0);
  }, null);

  const oldestWaitingJobSeconds = await safe(async () => {
    const rows = (await db.execute(
      sql`select extract(epoch from (now() - min(created_on)))::float8 as age from pgboss.job
        where state in ('created', 'retry') and start_after <= now()`
    )) as unknown as { age: number | null }[];
    return rows[0]?.age == null ? null : Number(rows[0].age);
  }, null);

  const backups = await safe(
    async () =>
      (await db.execute(
        sql`select status, max(finished_at) as finished_at from backup_runs
          where kind in ('nightly', 'manual') and status in ('ok', 'failed') and finished_at is not null
          group by status`
      )) as unknown as { status: string; finished_at: Date | string }[],
    []
  );
  const at = (status: string) => {
    const row = backups.find((b) => b.status === status);
    return row ? { finishedAt: new Date(row.finished_at) } : null;
  };

  return {
    workerAgeSeconds,
    failedJobsLast15Min,
    oldestWaitingJobSeconds,
    lastBackupOk: at('ok'),
    lastBackupFailed: at('failed'),
    diskUsedPercent: await readDiskUsedPercent(opts.diskPath ?? '/')
  };
}

export type MonitoringResult = { firing: Alert[]; notified: Alert[] };

/**
 * Evaluates every rule and records one in-app notice per firing rule (and one email when
 * ADMIN_ALERT_EMAIL_ENABLED is on). Runs in the worker every five minutes and from the host check, which
 * also catches a dead worker. The dedupe key makes the two places safe to run together.
 */
export async function runMonitoringCheck(
  opts: {
    db?: Db;
    provider?: EmailProvider;
    now?: Date;
    facts?: MonitoringFacts;
    diskPath?: string;
  } = {}
): Promise<MonitoringResult> {
  const now = opts.now ?? new Date();
  const db = opts.db ?? getWorkerDb();
  const facts = opts.facts ?? (await collectFacts({ db, diskPath: opts.diskPath }));
  const firing = evaluateRules(facts, now);
  const notified: Alert[] = [];
  for (const alert of firing) {
    const key = alertDedupeKey(alert.rule, now);
    const inserted = (await withSystem(
      (tx) =>
        tx.execute(
          sql`select record_staff_notification('ops_alert', ${`Alert: ${alert.title}`}, ${alert.detail}, '/admin/operations', ${key}) as id`
        ),
      { db }
    )) as unknown as { id: string | null }[];
    if (!inserted[0]?.id) continue;
    notified.push(alert);
    await emailAdmins(`Alert: ${alert.title}`, alert.detail, key, {
      db,
      provider: opts.provider
    });
  }
  return { firing, notified };
}
