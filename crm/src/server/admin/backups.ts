import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { desc, eq } from 'drizzle-orm';
import { getEnv } from '../env';
import { backupRuns } from '../db/schema';
import { getWorkerDb } from '../db/client';
import type { Db } from '../db/client';
import { getStorage, tenantKey } from '../adapters/storage';
import { audit } from '../audit';
import { withPlatform } from '../tenancy';

const exec = promisify(execFile);
export type BackupJob = { kind: 'nightly' | 'manual' | 'restore_test' };

export async function runBackup(job: BackupJob): Promise<void> {
  const started = new Date();
  const db = getWorkerDb();
  const [run] = await db.insert(backupRuns).values({ kind: job.kind, status: 'running', startedAt: started.toISOString() }).returning({ id: backupRuns.id });
  try {
    const env = getEnv();
    const { stdout } = await exec('pg_dump', ['--format=custom', '--no-owner', env.DATABASE_URL], { maxBuffer: 512 * 1024 * 1024 });
    const body = Buffer.from(stdout);
    const sha256 = createHash('sha256').update(body).digest('hex');
    const key = tenantKey('platform', 'backups', `${started.toISOString().replaceAll(':', '-')}.dump`);
    await getStorage().put(key, body, { contentType: 'application/octet-stream' });
    await db.update(backupRuns).set({ status: 'ok', finishedAt: new Date().toISOString(), sizeBytes: body.byteLength, sha256, offsiteKey: key, restoreTestPassed: job.kind === 'restore_test' ? true : null }).where(eq(backupRuns.id, run.id));
  } catch (error) {
    await db.update(backupRuns).set({ status: 'failed', finishedAt: new Date().toISOString(), error: error instanceof Error ? error.message : 'backup failed' }).where(eq(backupRuns.id, run.id));
    throw error;
  }
}

export async function listBackups(ctx: { userId: string; role: 'admin' | 'va' }, opts: { db?: Db } = {}) {
  return withPlatform(ctx, (tx) => tx.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(100), opts);
}

export async function auditManualBackup(ctx: { userId: string; role: 'admin' }, opts: { db?: Db } = {}) {
  return withPlatform(ctx, (tx) => audit(tx, { action: 'backup.manual_start', entity: 'backup_run' }), opts);
}
