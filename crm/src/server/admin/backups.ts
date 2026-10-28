import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { backupRuns } from '../db/schema';
import { getWorkerDb, type Db } from '../db/client';
import { getEnv } from '../env';
import { audit } from '../audit';
import { enqueue } from '../jobs';
import { AppError } from '../errors';
import { ProviderError } from '../adapters/errors';
import { getOptionalStorage } from '../adapters/storage';
import type { StorageAdapter } from '../adapters/storage';
import { withPlatform } from '../tenancy';

const BACKUP_PREFIX = 'encrypted-pg-dump-v1';
const BACKUP_KEY_PREFIX = 'backups/kynetic-crm';
const MAX_DUMP_BYTES = 2 * 1024 * 1024 * 1024;

export type BackupJob = { kind: 'nightly' | 'manual' | 'restore_test' };
export type BackupRuntime = {
  db?: Db;
  storage?: StorageAdapter;
  databaseUrl?: string;
  backupKey?: string;
  runCommand?: (command: string, args: string[], input?: Uint8Array) => Promise<Uint8Array>;
  now?: () => Date;
};

function keyBytes(value: string): Buffer {
  const asHex = /^[0-9a-f]{64}$/i.test(value)
    ? Buffer.from(value, 'hex')
    : Buffer.from(value, 'base64');
  if (asHex.length !== 32)
    throw new Error('BACKUP_ENCRYPTION_KEY must encode 32 bytes as base64 or hex');
  return asHex;
}

export function encryptBackup(plain: Uint8Array, secret: string): Uint8Array {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyBytes(secret), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from(`${BACKUP_PREFIX}\n`), iv, tag, encrypted]);
}

export function decryptBackup(encrypted: Uint8Array, secret: string): Uint8Array {
  const header = Buffer.from(`${BACKUP_PREFIX}\n`);
  const data = Buffer.from(encrypted);
  if (data.length < header.length + 28 || !data.subarray(0, header.length).equals(header))
    throw new Error('Invalid encrypted backup format');
  const iv = data.subarray(header.length, header.length + 12);
  const tag = data.subarray(header.length + 12, header.length + 28);
  const decipher = createDecipheriv('aes-256-gcm', keyBytes(secret), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(header.length + 28)), decipher.final()]);
}

function run(command: string, args: string[], input?: Uint8Array): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['pipe', 'pipe', 'pipe'] });
    const chunks: Buffer[] = [];
    const errors: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => errors.push(chunk));
    child.once('error', reject);
    child.once('close', (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else
        reject(
          new Error(
            `${command} failed with exit ${code}: ${Buffer.concat(errors).toString().slice(0, 500)}`
          )
        );
    });
    if (input) child.stdin.end(input);
    else child.stdin.end();
  });
}

async function dumpDatabase(databaseUrl: string, runCommand: BackupRuntime['runCommand'] = run) {
  return runCommand!('pg_dump', ['--format=custom', '--no-owner', '--no-privileges', databaseUrl]);
}

async function scratchRestore(
  plain: Uint8Array,
  databaseUrl: string,
  runCommand: BackupRuntime['runCommand'] = run
): Promise<void> {
  const scratch = await mkdtemp(join(tmpdir(), 'kynetic-restore-'));
  const dbName = `kynetic_restore_${randomBytes(5).toString('hex')}`;
  try {
    const scratchDump = join(scratch, 'restore.dump');
    await writeFile(scratchDump, plain, { mode: 0o600, flag: 'wx' });
    const url = new URL(databaseUrl);
    const maintenanceUrl = new URL(url);
    maintenanceUrl.pathname = '/postgres';
    await runCommand!('createdb', [
      '--maintenance-db',
      maintenanceUrl.toString(),
      '--template',
      'template0',
      dbName
    ]);
    try {
      await runCommand!('pg_restore', [
        '--exit-on-error',
        '--no-owner',
        '--no-privileges',
        '--dbname',
        new URL(`/${dbName}`, maintenanceUrl).toString(),
        scratchDump
      ]);
      const verify = await runCommand!('psql', [
        new URL(`/${dbName}`, maintenanceUrl).toString(),
        '-At',
        '-c',
        "select count(*) from information_schema.tables where table_schema='public'"
      ]);
      if (Number(Buffer.from(verify).toString().trim()) < 20)
        throw new Error('Restored database table count is unexpectedly low');
      const isolation = await runCommand!('psql', [
        new URL(`/${dbName}`, maintenanceUrl).toString(),
        '-At',
        '-c',
        "select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('contacts','deals','consents','tenant_documents')"
      ]);
      if (Number(Buffer.from(isolation).toString().trim()) !== 4)
        throw new Error('Restored tenant table schema check failed');
    } finally {
      await runCommand!('dropdb', [
        '--if-exists',
        '--maintenance-db',
        maintenanceUrl.toString(),
        dbName
      ]);
    }
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}

export async function runBackup(job: BackupJob, runtime: BackupRuntime = {}): Promise<void> {
  const db = runtime.db ?? getWorkerDb();
  const env = getEnv();
  const databaseUrl = runtime.databaseUrl ?? env.DATABASE_URL_BACKUP;
  const secret = runtime.backupKey ?? env.BACKUP_ENCRYPTION_KEY;
  const storage = runtime.storage ?? getOptionalStorage();
  if (!databaseUrl || !secret || !storage)
    throw new ProviderError(
      'config',
      'backup_not_configured',
      'Encrypted backup configuration is incomplete'
    );
  if (!runtime.databaseUrl && databaseUrl === env.DATABASE_URL)
    throw new ProviderError(
      'config',
      'backup_role_invalid',
      'Backups require the dedicated backup connection'
    );
  const now = runtime.now?.() ?? new Date();
  const runId = randomBytes(16).toString('hex');
  const key = `${BACKUP_KEY_PREFIX}/${now.toISOString().slice(0, 10)}/${job.kind}-${runId}.dump.enc`;
  const [{ id }] = await db
    .insert(backupRuns)
    .values({ kind: job.kind, status: 'running' })
    .returning({ id: backupRuns.id });
  try {
    const dump = await dumpDatabase(databaseUrl, runtime.runCommand);
    if (dump.byteLength === 0 || dump.byteLength > MAX_DUMP_BYTES)
      throw new Error('Dump size is outside the supported limit');
    const encrypted = encryptBackup(dump, secret);
    const sha256 = createHash('sha256').update(encrypted).digest('hex');
    await storage.put(key, encrypted, { contentType: 'application/octet-stream' });
    let restoreTestPassed = false;
    if (job.kind === 'restore_test' || job.kind === 'nightly') {
      const stored = await storage.get(key);
      if (!stored || createHash('sha256').update(stored.body).digest('hex') !== sha256)
        throw new Error('Uploaded backup failed read-after-write verification');
      const restored = decryptBackup(stored.body, secret);
      await scratchRestore(restored, databaseUrl, runtime.runCommand);
      restoreTestPassed = true;
    }
    await db
      .update(backupRuns)
      .set({
        status: 'ok',
        finishedAt: (runtime.now?.() ?? new Date()).toISOString(),
        sizeBytes: encrypted.byteLength,
        sha256,
        offsiteKey: key,
        restoreTestPassed
      })
      .where(eq(backupRuns.id, id));
    await pruneBackupRetention(storage, now);
  } catch (error) {
    await storage.remove(key).catch(() => undefined);
    await db
      .update(backupRuns)
      .set({
        status: 'failed',
        finishedAt: (runtime.now?.() ?? new Date()).toISOString(),
        error: error instanceof Error ? error.message.slice(0, 500) : 'backup_failed'
      })
      .where(eq(backupRuns.id, id));
    throw error;
  }
}

async function pruneBackupRetention(storage: StorageAdapter, now: Date) {
  // Store a per-object timestamp in the key; remove expired objects only after successful runs.
  const objects = await storage.list?.(`${BACKUP_KEY_PREFIX}/`);
  if (!objects) return;
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - 395);
  for (const object of objects) {
    const match = object.key.match(/^backups\/kynetic-crm\/(\d{4}-\d{2}-\d{2})\//);
    if (match && new Date(`${match[1]}T00:00:00Z`) < cutoff) await storage.remove(object.key);
  }
}

export async function handleBackupJob(job: BackupJob): Promise<void> {
  return runBackup(job);
}

export async function listBackups(
  ctx: { userId: string; role: 'admin' | 'va' },
  opts: { db?: Db } = {}
) {
  return withPlatform(
    ctx,
    (tx) => tx.select().from(backupRuns).orderBy(desc(backupRuns.startedAt)).limit(100),
    opts
  );
}

export async function auditManualBackup(
  ctx: { userId: string; role: 'admin' },
  opts: { db?: Db } = {}
) {
  if (ctx.role !== 'admin') throw new AppError('FORBIDDEN');
  await withPlatform(
    ctx,
    (tx) => audit(tx, { action: 'backup.manual_start', entity: 'backup_run' }),
    opts
  );
  await enqueue('backup.run', { kind: 'manual' });
}
