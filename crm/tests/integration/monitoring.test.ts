import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { createDb, type Db } from '@/server/db/client';
import { resetEnvCacheForTests } from '@/server/env';
import { enqueue, stopJobs } from '@/server/jobs';
import { collectFacts, runMonitoringCheck } from '@/server/monitoring/run';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let workerDb: Db;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  workerDb = createDb(tdb.worker);
  Object.assign(process.env, {
    NODE_ENV: 'test',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    APP_BASE_URL: 'https://dev.kyneticai.com',
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real',
    OUTBOUND_ENABLED: 'false',
    ADMIN_ALERT_EMAIL_ENABLED: 'true'
  });
  resetEnvCacheForTests();
});

afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const notices = async () =>
  (await tdb.admin`select kind, title, body, link from staff_notifications where kind = 'ops_alert' order by created_at`) as unknown as {
    kind: string;
    title: string;
    body: string;
    link: string;
  }[];

describe('monitoring alerts, end to end against the database', () => {
  it('dead worker: no heartbeat, then a stale one, each records one notice and emails admins', async () => {
    const mail = new FakeEmailProvider();
    const t0 = new Date('2026-11-13T12:00:00Z');
    const none = await runMonitoringCheck({ db: workerDb, provider: mail, now: t0, diskPath: '/' });
    expect(none.firing.map((a) => a.rule)).toContain('worker_heartbeat');
    expect(none.notified.map((a) => a.rule)).toContain('worker_heartbeat');
    expect(mail.sent.some((m) => m.subject === 'Alert: Worker has no heartbeat')).toBe(true);

    await tdb.admin`insert into worker_heartbeats (name, beat_at) values ('worker', now() - interval '10 minutes')
      on conflict (name) do update set beat_at = excluded.beat_at`;
    const stale = await runMonitoringCheck({
      db: workerDb,
      provider: mail,
      now: new Date('2026-11-13T18:00:00Z')
    });
    expect(stale.notified.map((a) => a.title)).toContain('Worker is down');
    const rows = await notices();
    expect(rows.every((r) => r.link === '/admin/operations')).toBe(true);
    expect(rows.map((r) => r.title)).toContain('Alert: Worker is down');

    await tdb.admin`update worker_heartbeats set beat_at = now()`;
    const healthy = await collectFacts({ db: workerDb });
    expect(healthy.workerAgeSeconds).toBeLessThan(5);
  });

  it('does not repeat a notice inside six hours, and repeats after', async () => {
    const mail = new FakeEmailProvider();
    const facts = {
      workerAgeSeconds: 900,
      failedJobsLast15Min: 0,
      oldestWaitingJobSeconds: null,
      lastBackupOk: { finishedAt: new Date('2026-11-14T09:00:00Z') },
      lastBackupFailed: null,
      diskUsedPercent: 10
    };
    const first = await runMonitoringCheck({
      db: workerDb,
      provider: mail,
      facts,
      now: new Date('2026-11-14T12:00:00Z')
    });
    const inside = await runMonitoringCheck({
      db: workerDb,
      provider: mail,
      facts,
      now: new Date('2026-11-14T13:00:00Z')
    });
    const after = await runMonitoringCheck({
      db: workerDb,
      provider: mail,
      facts,
      now: new Date('2026-11-14T18:30:00Z')
    });
    expect(first.notified).toHaveLength(1);
    expect(inside.firing).toHaveLength(1);
    expect(inside.notified).toHaveLength(0);
    expect(after.notified).toHaveLength(1);
  });

  it('failed backup: reads backup_runs and alerts, and goes quiet after a good run', async () => {
    await tdb.admin`delete from backup_runs`;
    await tdb.admin`insert into backup_runs (kind, status, started_at, finished_at, error)
      values ('nightly', 'failed', now() - interval '2 hours', now() - interval '2 hours', 'pg_dump version mismatch')`;
    const bad = await collectFacts({ db: workerDb });
    expect(bad.lastBackupFailed).not.toBeNull();
    expect(bad.lastBackupOk).toBeNull();
    const mail = new FakeEmailProvider();
    const result = await runMonitoringCheck({
      db: workerDb,
      provider: mail,
      facts: { ...bad, workerAgeSeconds: 5, diskUsedPercent: 10 },
      now: new Date('2026-11-15T12:00:00Z')
    });
    expect(result.notified.map((a) => a.rule).sort()).toEqual(['backup_failed', 'backup_stale']);
    const row = (await notices()).find((n) => n.title === 'Alert: The latest backup failed');
    expect(row?.body).not.toContain('version mismatch');

    await tdb.admin`insert into backup_runs (kind, status, started_at, finished_at)
      values ('manual', 'ok', now() - interval '1 hour', now() - interval '1 hour')`;
    const good = await collectFacts({ db: workerDb });
    expect(good.lastBackupOk).not.toBeNull();
  });

  it('failed jobs: counts jobs that failed in the last 15 minutes', async () => {
    // The queue allows one waiting job at a time, so fail each one before queuing the next.
    for (let i = 0; i < 6; i += 1) {
      await enqueue('usage.daily', { n: i });
      await tdb.admin`update pgboss.job set state = 'failed', completed_on = now() where name = 'usage.daily' and state = 'created'`;
    }
    const facts = await collectFacts({ db: workerDb });
    expect(facts.failedJobsLast15Min).toBe(6);
    const mail = new FakeEmailProvider();
    const result = await runMonitoringCheck({
      db: workerDb,
      provider: mail,
      facts: { ...facts, workerAgeSeconds: 5, diskUsedPercent: 10 },
      now: new Date('2026-11-16T12:00:00Z')
    });
    expect(result.notified.map((a) => a.rule)).toContain('failed_jobs');
  });

  it('disk: a path that is not readable is skipped instead of failing the check', async () => {
    const facts = await collectFacts({ db: workerDb, diskPath: '/definitely/not/here' });
    expect(facts.diskUsedPercent).toBeNull();
    const real = await collectFacts({ db: workerDb, diskPath: '/' });
    expect(real.diskUsedPercent).toBeGreaterThan(0);
  });

  it('the app role cannot record an ops alert', async () => {
    const appDb = createDb(tdb.app);
    await expect(
      appDb.execute(
        (await import('drizzle-orm'))
          .sql`select record_staff_notification('ops_alert', 't', 'b', '/x', 'k-app')`
      )
    ).rejects.toThrow();
  });
});
