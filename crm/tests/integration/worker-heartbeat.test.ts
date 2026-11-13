import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Only the env module is faked (the route needs two values); everything else is real.
vi.mock('@/server/env', () => ({
  getEnv: () => ({
    DATABASE_URL: process.env.DATABASE_URL,
    BUILD_COMMIT_SHA: process.env.BUILD_COMMIT_SHA
  })
}));

import { createDb, type Db } from '@/server/db/client';
import { readHealth } from '@/server/db/ping';
import { startWorkerHeartbeat, writeWorkerHeartbeat } from '@/server/worker-heartbeat';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let workerDb: Db;

beforeAll(async () => {
  tdb = await createTestDatabase();
  workerDb = createDb(tdb.worker);
});
afterAll(async () => {
  await tdb?.drop();
});

async function route() {
  const { GET } = await import('@/app/api/health/route');
  const res = await GET();
  return { status: res.status, body: await res.json() };
}

describe('/api/health and the worker heartbeat (P0-3)', () => {
  it('is 503 with worker=missing when no heartbeat exists', async () => {
    const health = await readHealth(tdb.urls.app);
    expect(health).toEqual({ database: true, workerAgeSeconds: null });
    process.env.DATABASE_URL = tdb.urls.app;
    const { status, body } = await route();
    expect(status).toBe(503);
    expect(body.checks).toEqual({ database: 'ok', worker: 'missing' });
  });

  it('is 200 with a fresh heartbeat and reports the commit', async () => {
    process.env.BUILD_COMMIT_SHA = 'abc1234';
    await writeWorkerHeartbeat(workerDb);
    process.env.DATABASE_URL = tdb.urls.app;
    const { status, body } = await route();
    expect(status).toBe(200);
    expect(body).toMatchObject({ status: 'ok', commit: 'abc1234', checks: { worker: 'ok' } });
    const [row] = await tdb.admin`select commit_sha from worker_heartbeats where name = 'worker'`;
    expect(row.commit_sha).toBe('abc1234');
  });

  it('is 503 with worker=stale when the heartbeat is older than the limit', async () => {
    await tdb.admin`update worker_heartbeats set beat_at = now() - interval '10 minutes'`;
    process.env.DATABASE_URL = tdb.urls.app;
    const { status, body } = await route();
    expect(status).toBe(503);
    expect(body.checks.worker).toBe('stale');
    expect(body.worker.lastHeartbeatSecondsAgo).toBeGreaterThanOrEqual(600);
  });

  it('recovers to 200 once the worker beats again', async () => {
    const stop = startWorkerHeartbeat(workerDb, { intervalMs: 60_000 });
    try {
      await expect
        .poll(async () => (await readHealth(tdb.urls.app)).workerAgeSeconds, { timeout: 5000 })
        .toBeLessThan(5);
    } finally {
      stop();
    }
    process.env.DATABASE_URL = tdb.urls.app;
    expect((await route()).status).toBe(200);
  });

  it('the app role can read but not write heartbeats; the auth role cannot read them', async () => {
    // Row-level security hides every row from an app-role UPDATE, so nothing changes.
    expect((await tdb.app`update worker_heartbeats set beat_at = now()`).count).toBe(0);
    await expect(tdb.app`insert into worker_heartbeats (name) values ('forged')`).rejects.toThrow();
    expect(await tdb.app`select 1 from worker_heartbeats`).toHaveLength(1);
    await expect(tdb.auth`select 1 from worker_heartbeats`).rejects.toThrow();
  });

  it('is 503 with database=fail when the database is unreachable', async () => {
    process.env.DATABASE_URL = 'postgres://nobody:x@127.0.0.1:1/none';
    const { status, body } = await route();
    expect(status).toBe(503);
    expect(body.checks.database).toBe('fail');
  });
});
