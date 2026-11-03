import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import {
  decryptBackup,
  encryptBackup,
  pruneBackupRetention,
  runBackup
} from '@/server/admin/backups';
import { auditManualBackup, listBackups } from '@/server/admin/backups';
import { stopJobs } from '@/server/jobs';

let tdb: TestDatabase;
let db: Db;
const storage = new FakeStorage();
const secret = Buffer.alloc(32, 7).toString('base64');

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.worker);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real'
  });
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = createDb(tdb.app);
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('F-63 encrypted database backup and restore drill', () => {
  it('encrypts and authenticates backup bytes', () => {
    const plain = new TextEncoder().encode('synthetic-dump-bytes');
    const encrypted = encryptBackup(plain, secret);
    expect(Buffer.from(encrypted)).not.toContain(Buffer.from(plain).toString());
    expect(Buffer.from(decryptBackup(encrypted, secret))).toEqual(Buffer.from(plain));
    const changed = new Uint8Array(encrypted);
    changed[changed.length - 1] ^= 1;
    expect(() => decryptBackup(changed, secret)).toThrow();
  });

  it('runs a real pg_dump, encrypts it, uploads it, restores to scratch, verifies tenant schema and removes scratch', async () => {
    const scratchDatabases =
      await tdb.admin`select datname from pg_database where datname like 'kynetic_restore_%'`;
    expect(scratchDatabases).toHaveLength(0);
    await runBackup(
      { kind: 'restore_test' },
      {
        db,
        storage,
        databaseUrl: tdb.urls.backup,
        backupKey: secret,
        now: () => new Date('2026-10-28T12:00:00.000Z')
      }
    );
    const rows =
      await tdb.admin`select status, size_bytes, sha256, offsite_key, restore_test_passed from backup_runs order by started_at desc limit 1`;
    expect(rows[0]).toMatchObject({ status: 'ok', restore_test_passed: true });
    expect(Number(rows[0]!.size_bytes)).toBeGreaterThan(0);
    expect(rows[0]!.offsite_key).toContain('restore_test-');
    const stored = await storage.get(rows[0]!.offsite_key as string);
    expect(stored).not.toBeNull();
    expect(
      Buffer.from(stored!.body).subarray(0, Buffer.byteLength('encrypted-pg-dump-v1\n')).toString()
    ).toBe('encrypted-pg-dump-v1\n');
    const after =
      await tdb.admin`select datname from pg_database where datname like 'kynetic_restore_%'`;
    expect(after).toHaveLength(0);
  });

  it('backup role is a non-superuser with dump and scratch-restore privileges but no table writes', async () => {
    const grants =
      await tdb.admin`select rolbypassrls, rolsuper, rolcreatedb from pg_roles where rolname = 'kynetic_backup'`;
    expect(grants[0]).toMatchObject({ rolbypassrls: true, rolsuper: false, rolcreatedb: true });
    await expect(
      tdb.backup`insert into tenants (slug, name, plan, timezone) values ('forbidden', 'Forbidden', 'founding', 'UTC')`
    ).rejects.toThrow();
  });

  it('keeps the newest 30 daily and 12 monthly encrypted objects', async () => {
    const retentionStorage = new FakeStorage();
    for (let i = 0; i < 35; i += 1) {
      const day = new Date(Date.UTC(2026, 0, i + 1)).toISOString().slice(0, 10);
      const id = String(i).padStart(32, '0');
      await retentionStorage.put(
        `backups/kynetic-crm/${day}/nightly-${id}.dump.enc`,
        new Uint8Array([i])
      );
    }
    for (let i = 0; i < 14; i += 1) {
      const day = new Date(Date.UTC(2025, i, 1)).toISOString().slice(0, 10);
      const id = String(i).padStart(32, '0');
      await retentionStorage.put(
        `backups/kynetic-crm/${day}/restore_test-${id}.dump.enc`,
        new Uint8Array([i])
      );
    }
    await pruneBackupRetention(retentionStorage, new Date('2026-10-28T12:00:00Z'));
    const remaining = await retentionStorage.list('backups/kynetic-crm/');
    expect(remaining).toHaveLength(42);
    expect(remaining.filter((object) => object.key.includes('/nightly-'))).toHaveLength(30);
    expect(remaining.filter((object) => object.key.includes('/restore_test-'))).toHaveLength(12);
  });

  it('lists backups for admin and VA and queues manual backups only for admin', async () => {
    await expect(listBackups({ userId: IDS.admin, role: 'admin' })).resolves.toBeDefined();
    await expect(listBackups({ userId: IDS.va, role: 'va' })).resolves.toBeDefined();
    await expect(
      tdb.app.begin(async (tx) => {
        await tx`select set_config('app.user_id', ${IDS.ownerA}, true), set_config('app.role', 'owner', true)`;
        return tx`select * from admin_list_backup_runs()`;
      })
    ).rejects.toThrow(/insufficient privilege/);
    await expect(auditManualBackup({ userId: IDS.va, role: 'va' } as never)).rejects.toThrow();
    await auditManualBackup({ userId: IDS.admin, role: 'admin' });
    const rows =
      await tdb.admin`select action, actor_user_id from audit_log where action = 'backup.manual_start'`;
    expect(rows).toContainEqual({ action: 'backup.manual_start', actor_user_id: IDS.admin });
    const jobs = await tdb.admin`select name, data from pgboss.job where name = 'backup.run'`;
    expect(jobs).toContainEqual({ name: 'backup.run', data: { kind: 'manual' } });
  });
});
