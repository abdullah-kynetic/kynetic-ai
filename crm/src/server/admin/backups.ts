import { desc } from 'drizzle-orm';
import { backupRuns } from '../db/schema';
import type { Db } from '../db/client';
import { audit } from '../audit';
import { withPlatform } from '../tenancy';

export type BackupJob = { kind: 'nightly' | 'manual' | 'restore_test' };

export async function runBackup(_job: BackupJob): Promise<void> {
  throw new Error('Backup unavailable: encrypted dump and verified restore are not implemented');
}

export async function listBackups(ctx: { userId: string; role: 'admin' | 'va' }, opts: { db?: Db } = {}) {
  return withPlatform(ctx, (tx) => tx.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(100), opts);
}

export async function auditManualBackup(ctx: { userId: string; role: 'admin' }, opts: { db?: Db } = {}) {
  return withPlatform(ctx, (tx) => audit(tx, { action: 'backup.manual_start', entity: 'backup_run' }), opts);
}
