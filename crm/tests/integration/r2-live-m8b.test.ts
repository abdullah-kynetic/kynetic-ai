import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  decryptBackup,
  pruneBackupRetention,
  runBackup
} from '@/server/admin/backups';
import { R2Storage } from '@/server/adapters/storage/r2';
import type { StorageAdapter } from '@/server/adapters/storage/types';
import { mintSignedUrl, tenantKey } from '@/server/adapters/storage/tenant-keys';
import { presignGetUrl } from '@/server/adapters/storage/sigv4';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

const enabled = process.env.R2_LIVE_TESTS === '1';
const bucket = process.env.STORAGE_BUCKET;
const endpoint = process.env.STORAGE_ENDPOINT;
const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

class RunPrefixStorage implements StorageAdapter {
  constructor(
    private readonly inner: R2Storage,
    private readonly prefix: string
  ) {}

  private key(key: string) {
    return `${this.prefix}${key}`;
  }

  put(key: string, body: Uint8Array, opts?: { contentType?: string }) {
    return this.inner.put(this.key(key), body, opts);
  }

  get(key: string) {
    return this.inner.get(this.key(key));
  }

  remove(key: string) {
    return this.inner.remove(this.key(key));
  }

  signedGetUrl(key: string) {
    return this.inner.signedGetUrl(this.key(key));
  }

  async list(prefix: string) {
    const objects = await this.inner.list(this.key(prefix));
    return objects.map((object) => ({
      key: object.key.slice(this.prefix.length),
      lastModified: object.lastModified
    }));
  }

  async cleanup() {
    const objects = await this.inner.list(this.prefix);
    for (const object of objects) await this.inner.remove(object.key);
  }
}

let tdb: TestDatabase;
let db: Db;
let raw: R2Storage;
let storage: RunPrefixStorage;
let livePrefix: string;
let backupKey: string;

describe.skipIf(!enabled)('authorized R2 test-bucket acceptance (F-27, F-39, F-63)', () => {
  beforeAll(async () => {
    if (bucket !== 'kynetic-portal-test') {
      throw new Error('Refusing R2 live test: STORAGE_BUCKET must equal kynetic-portal-test');
    }
    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new Error('R2 live test endpoint or credentials are missing');
    }
    tdb = await createTestDatabase();
    await seedTwoTenants(tdb.admin);
    db = createDb(tdb.worker);
    backupKey = Buffer.alloc(32, 23).toString('base64');
    Object.assign(process.env, {
      APP_BASE_URL: 'http://localhost:3000',
      DATABASE_URL: tdb.urls.app,
      DATABASE_URL_AUTH: tdb.authUrl,
      BETTER_AUTH_SECRET: 'r2-test-only-better-auth-secret-not-real',
      APP_ENCRYPTION_KEY: 'r2-test-only-app-encryption-key-not-real',
      BACKUP_ENCRYPTION_KEY: backupKey
    });
    raw = new R2Storage({
      endpoint,
      bucket,
      credentials: { accessKeyId, secretAccessKey }
    });
    livePrefix = `codex-r2-verification/${randomUUID()}/`;
    storage = new RunPrefixStorage(raw, livePrefix);
  });

  afterAll(async () => {
    try {
      await storage?.cleanup();
      if (raw && livePrefix) expect(await raw.list(livePrefix)).toEqual([]);
    } finally {
      await tdb?.drop();
    }
  });

  it('uploads and downloads synthetic objects, enforces tenant prefixes, and checks URL expiry', async () => {
    const tenantA = randomUUID();
    const tenantB = randomUUID();
    const runId = randomUUID();
    const keyA = tenantKey(tenantA, 'synthetic', `${runId}.txt`);
    const keyB = tenantKey(tenantB, 'synthetic', `${runId}.txt`);
    const bodyA = new TextEncoder().encode('synthetic tenant A object');
    const bodyB = new TextEncoder().encode('synthetic tenant B object');

    try {
      // Exercise the canonical tenant UUID prefix directly in the R2 bucket.
      await raw.put(keyA, bodyA, { contentType: 'text/plain' });
      await raw.put(keyB, bodyB, { contentType: 'text/plain' });
      const listedA = await raw.list(`${tenantA}/`);
      expect(listedA.map((object) => object.key)).toContain(keyA);
      expect(listedA.map((object) => object.key)).not.toContain(keyB);
      expect(await raw.get(keyA)).toMatchObject({ body: bodyA, contentType: 'text/plain' });
      await expect(mintSignedUrl(raw, tenantA, keyB)).rejects.toMatchObject({
        code: 'NOT_FOUND',
        status: 404
      });

      const appUrl = new URL(await mintSignedUrl(raw, tenantA, keyA));
      expect(appUrl.searchParams.get('X-Amz-Expires')).toBe('300');
      const validResponse = await fetch(appUrl);
      expect(validResponse.ok).toBe(true);
      expect(new Uint8Array(await validResponse.arrayBuffer())).toEqual(bodyA);

      const shortUrl = presignGetUrl({
        creds: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
        region: 'auto',
        origin: new URL(endpoint!).origin,
        path: `/${bucket}/${keyA}`,
        expiresInS: 5,
        now: new Date()
      });
      expect((await fetch(shortUrl)).ok).toBe(true);
      await new Promise((resolve) => setTimeout(resolve, 6_000));
      const expiredResponse = await fetch(shortUrl);
      expect([400, 403]).toContain(expiredResponse.status);
    } finally {
      await raw.remove(keyA);
      await raw.remove(keyB);
      expect((await raw.list(`${tenantA}/`)).map((object) => object.key)).not.toContain(keyA);
      expect((await raw.list(`${tenantB}/`)).map((object) => object.key)).not.toContain(keyB);
    }
  }, 30_000);

  it('uploads, lists and downloads the encrypted backup from R2, restores it to scratch, and enforces retention', async () => {
    await runBackup(
      { kind: 'restore_test' },
      {
        db,
        storage,
        databaseUrl: tdb.urls.backup,
        backupKey,
        now: () => new Date('2026-10-28T12:00:00.000Z')
      }
    );
    const [row] = await tdb.admin`
      select offsite_key, status, restore_test_passed
      from backup_runs order by started_at desc limit 1`;
    expect(row).toMatchObject({ status: 'ok', restore_test_passed: true });
    const objects = await storage.list('backups/kynetic-crm/');
    expect(objects.map((object) => object.key)).toContain(row.offsite_key);
    const downloaded = await storage.get(row.offsite_key as string);
    expect(downloaded).not.toBeNull();
    expect(Buffer.from(downloaded!.body).subarray(0, 21).toString()).toBe('encrypted-pg-dump-v1\n');
    expect(decryptBackup(downloaded!.body, backupKey).byteLength).toBeGreaterThan(0);

    for (let index = 0; index < 35; index++) {
      const day = new Date(Date.UTC(2026, 9, index + 1)).toISOString().slice(0, 10);
      const id = index.toString(16).padStart(32, '0');
      await storage.put(`backups/kynetic-crm/${day}/nightly-${id}.dump.enc`, new Uint8Array([index]));
    }
    for (let index = 0; index < 14; index++) {
      const day = new Date(Date.UTC(2027, index, 1)).toISOString().slice(0, 10);
      const id = (index + 100).toString(16).padStart(32, '0');
      await storage.put(`backups/kynetic-crm/${day}/restore_test-${id}.dump.enc`, new Uint8Array([index]));
    }
    await pruneBackupRetention(storage, new Date('2026-10-28T12:00:00.000Z'));
    const retained = await storage.list('backups/kynetic-crm/');
    expect(retained.filter((object) => /\/nightly-/.test(object.key))).toHaveLength(30);
    expect(retained.filter((object) => /\/restore_test-/.test(object.key))).toHaveLength(12);
  }, 120_000);
});
