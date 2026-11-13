import { WORKER_HEARTBEAT_MAX_AGE_S } from '../worker-heartbeat';

/**
 * Alert rules for the portal (phase 4). Pure: facts in, alerts out, so every rule is a unit test.
 * An alert never carries message bodies, contact data or secrets; only counts, ages and percentages.
 */
export type RuleName =
  | 'worker_heartbeat'
  | 'failed_jobs'
  | 'queue_age'
  | 'backup_failed'
  | 'backup_stale'
  | 'disk';

export type MonitoringFacts = {
  /** Seconds since the worker's last beat by the database clock. Null: no heartbeat row. */
  workerAgeSeconds: number | null;
  /** Jobs that ended in `failed` during the last 15 minutes. Null: the queue tables could not be read. */
  failedJobsLast15Min: number | null;
  /** Age of the oldest job that is ready to run but has not started. Null: nothing waiting, or unreadable. */
  oldestWaitingJobSeconds: number | null;
  /** Newest finished nightly or manual backup run, by outcome. */
  lastBackupOk: { finishedAt: Date } | null;
  lastBackupFailed: { finishedAt: Date } | null;
  /** Used share of the data disk, 0 to 100. Null: not readable. */
  diskUsedPercent: number | null;
};

export type Thresholds = {
  workerMaxAgeSeconds: number;
  failedJobs: number;
  queueAgeSeconds: number;
  backupMaxAgeHours: number;
  diskPercent: number;
};

export const DEFAULT_THRESHOLDS: Thresholds = {
  workerMaxAgeSeconds: WORKER_HEARTBEAT_MAX_AGE_S,
  failedJobs: 5,
  queueAgeSeconds: 600,
  backupMaxAgeHours: 26,
  diskPercent: 80
};

export type Alert = {
  rule: RuleName;
  title: string;
  detail: string;
};

const HOUR_MS = 60 * 60 * 1000;

export function evaluateRules(
  facts: MonitoringFacts,
  now: Date,
  t: Thresholds = DEFAULT_THRESHOLDS
): Alert[] {
  const alerts: Alert[] = [];

  if (facts.workerAgeSeconds === null) {
    alerts.push({
      rule: 'worker_heartbeat',
      title: 'Worker has no heartbeat',
      detail:
        'The worker has never recorded a heartbeat, or it cannot be read. Backups, reports and call jobs are not running.'
    });
  } else if (facts.workerAgeSeconds > t.workerMaxAgeSeconds) {
    alerts.push({
      rule: 'worker_heartbeat',
      title: 'Worker is down',
      detail: `The last worker heartbeat was ${Math.round(facts.workerAgeSeconds)} seconds ago (limit ${t.workerMaxAgeSeconds}). Backups, reports and call jobs are not running.`
    });
  }

  if (facts.failedJobsLast15Min !== null && facts.failedJobsLast15Min > t.failedJobs) {
    alerts.push({
      rule: 'failed_jobs',
      title: 'Many jobs are failing',
      detail: `${facts.failedJobsLast15Min} jobs failed in the last 15 minutes (limit ${t.failedJobs}).`
    });
  }

  if (facts.oldestWaitingJobSeconds !== null && facts.oldestWaitingJobSeconds > t.queueAgeSeconds) {
    alerts.push({
      rule: 'queue_age',
      title: 'Jobs are waiting too long',
      detail: `The oldest waiting job is ${Math.round(facts.oldestWaitingJobSeconds)} seconds old (limit ${t.queueAgeSeconds}).`
    });
  }

  const ok = facts.lastBackupOk?.finishedAt ?? null;
  const failed = facts.lastBackupFailed?.finishedAt ?? null;
  if (failed && (!ok || failed.getTime() > ok.getTime())) {
    alerts.push({
      rule: 'backup_failed',
      title: 'The latest backup failed',
      detail: `The newest backup run ended in failure at ${failed.toISOString()}, and no good backup has finished since. See /admin/backups.`
    });
  }
  const ageHours = ok ? (now.getTime() - ok.getTime()) / HOUR_MS : null;
  if (ageHours === null || ageHours > t.backupMaxAgeHours) {
    alerts.push({
      rule: 'backup_stale',
      title: 'No recent good backup',
      detail:
        ageHours === null
          ? 'No backup has ever finished successfully.'
          : `The newest good backup is ${Math.floor(ageHours)} hours old (limit ${t.backupMaxAgeHours}).`
    });
  }

  if (facts.diskUsedPercent !== null && facts.diskUsedPercent > t.diskPercent) {
    alerts.push({
      rule: 'disk',
      title: 'Disk is filling up',
      detail: `The data disk is ${Math.round(facts.diskUsedPercent)}% full (limit ${t.diskPercent}%).`
    });
  }

  return alerts;
}

/** One notice per rule per six hours while the problem lasts, shared by every place the check runs. */
export const ALERT_REPEAT_HOURS = 6;

export function alertDedupeKey(rule: RuleName, now: Date): string {
  return `monitor:${rule}:${Math.floor(now.getTime() / (ALERT_REPEAT_HOURS * HOUR_MS))}`;
}
