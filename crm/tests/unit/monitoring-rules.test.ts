import { describe, expect, it } from 'vitest';
import {
  alertDedupeKey,
  DEFAULT_THRESHOLDS,
  evaluateRules,
  type MonitoringFacts
} from '@/server/monitoring/rules';

const now = new Date('2026-11-13T12:00:00Z');
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);

const healthy: MonitoringFacts = {
  workerAgeSeconds: 20,
  failedJobsLast15Min: 0,
  oldestWaitingJobSeconds: null,
  lastBackupOk: { finishedAt: hoursAgo(5) },
  lastBackupFailed: null,
  diskUsedPercent: 40
};
const rules = (facts: Partial<MonitoringFacts>) =>
  evaluateRules({ ...healthy, ...facts }, now).map((a) => a.rule);

describe('alert rules', () => {
  it('stays quiet when everything is healthy', () => {
    expect(rules({})).toEqual([]);
  });

  it('worker heartbeat: fires on a stale or missing beat, not at the limit', () => {
    expect(rules({ workerAgeSeconds: DEFAULT_THRESHOLDS.workerMaxAgeSeconds })).toEqual([]);
    expect(rules({ workerAgeSeconds: DEFAULT_THRESHOLDS.workerMaxAgeSeconds + 1 })).toEqual([
      'worker_heartbeat'
    ]);
    expect(rules({ workerAgeSeconds: null })).toEqual(['worker_heartbeat']);
  });

  it('failed jobs: fires above 5 in 15 minutes, ignores an unreadable queue', () => {
    expect(rules({ failedJobsLast15Min: 5 })).toEqual([]);
    expect(rules({ failedJobsLast15Min: 6 })).toEqual(['failed_jobs']);
    expect(rules({ failedJobsLast15Min: null })).toEqual([]);
  });

  it('queue age: fires when the oldest waiting job is over 10 minutes old', () => {
    expect(rules({ oldestWaitingJobSeconds: 600 })).toEqual([]);
    expect(rules({ oldestWaitingJobSeconds: 601 })).toEqual(['queue_age']);
  });

  it('backup failed: fires when the newest finished run failed after the last good one', () => {
    expect(rules({ lastBackupFailed: { finishedAt: hoursAgo(10) } })).toEqual([]);
    expect(rules({ lastBackupFailed: { finishedAt: hoursAgo(1) } })).toEqual(['backup_failed']);
  });

  it('backup stale: fires after 26 hours and when no backup ever worked', () => {
    expect(rules({ lastBackupOk: { finishedAt: hoursAgo(26) } })).toEqual([]);
    expect(rules({ lastBackupOk: { finishedAt: hoursAgo(27) } })).toEqual(['backup_stale']);
    expect(rules({ lastBackupOk: null })).toEqual(['backup_stale']);
  });

  it('a backup that has only ever failed fires both backup rules', () => {
    expect(rules({ lastBackupOk: null, lastBackupFailed: { finishedAt: hoursAgo(3) } })).toEqual([
      'backup_failed',
      'backup_stale'
    ]);
  });

  it('disk: fires above 80 percent, ignores an unreadable disk', () => {
    expect(rules({ diskUsedPercent: 80 })).toEqual([]);
    expect(rules({ diskUsedPercent: 80.4 })).toEqual(['disk']);
    expect(rules({ diskUsedPercent: null })).toEqual([]);
  });

  it('alert text carries counts and ages only', () => {
    const [alert] = evaluateRules({ ...healthy, failedJobsLast15Min: 9 }, now);
    expect(alert!.detail).toBe('9 jobs failed in the last 15 minutes (limit 5).');
  });

  it('dedupe key changes every six hours and is stable inside the window', () => {
    const a = alertDedupeKey('disk', new Date('2026-11-13T06:00:00Z'));
    expect(alertDedupeKey('disk', new Date('2026-11-13T11:59:00Z'))).toBe(a);
    expect(alertDedupeKey('disk', new Date('2026-11-13T12:00:00Z'))).not.toBe(a);
    expect(alertDedupeKey('failed_jobs', new Date('2026-11-13T06:00:00Z'))).not.toBe(a);
  });
});
