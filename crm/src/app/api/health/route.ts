import { NextResponse } from 'next/server';
import { buildCommit } from '@/server/build-info';
import { readHealth } from '@/server/db/ping';
import { getEnv } from '@/server/env';
import { WORKER_HEARTBEAT_MAX_AGE_S, workerStatus } from '@/server/worker-heartbeat';

export const dynamic = 'force-dynamic';

// 200 only when the database answers and the worker has beaten within WORKER_HEARTBEAT_MAX_AGE_S.
// A dead worker means no backups, reports or call jobs, so it counts as unhealthy.
export async function GET() {
  const { database, workerAgeSeconds } = await readHealth(getEnv().DATABASE_URL);
  const worker = workerStatus(workerAgeSeconds);
  const healthy = database && worker === 'ok';
  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      commit: buildCommit(),
      checks: { database: database ? 'ok' : 'fail', worker },
      worker: {
        lastHeartbeatSecondsAgo: workerAgeSeconds === null ? null : Math.round(workerAgeSeconds),
        maxAgeSeconds: WORKER_HEARTBEAT_MAX_AGE_S
      }
    },
    { status: healthy ? 200 : 503, headers: { 'Cache-Control': 'no-store' } }
  );
}
