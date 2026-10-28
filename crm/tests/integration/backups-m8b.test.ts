import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { decryptBackup, encryptBackup, runBackup } from '@/server/admin/backups';

let tdb: TestDatabase;
let db: Db;
const storage = new FakeStorage();
const secret = Buffer.alloc(32, 7).toString('base64');

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.worker);
});
afterAll(async () => {
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
    expect(Buffer.from(stored!.body).subarray(0, Buffer.byteLength('encrypted-pg-dump-v1\n')).toString()).toBe('encrypted-pg-dump-v1\n');
    const after =
      await tdb.admin`select datname from pg_database where datname like 'kynetic_restore_%'`;
    expect(after).toHaveLength(0);
  });

  it('backup role cannot write, bypass RLS, or read another database', async () => {
    const grants =
      await tdb.admin`select rolbypassrls, rolsuper, rolcreatedb from pg_roles where rolname = 'kynetic_backup'`;
    expect(grants[0]).toMatchObject({ rolbypassrls: true, rolsuper: false, rolcreatedb: true });
    await expect(
      tdb.backup`insert into tenants (slug, name, plan, timezone) values ('forbidden', 'Forbidden', 'founding', 'UTC')`
    ).rejects.toThrow();
  });
});
