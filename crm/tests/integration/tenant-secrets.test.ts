import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';
import { createDb, type Db } from '@/server/db/client';
import { buildKeyring } from '@/server/secrets/crypto';
import {
  listTenantSecretStatus,
  readTenantSecret,
  reencryptTenantSecrets,
  writeTenantSecret
} from '@/server/secrets';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const K1 = 'a'.repeat(40);
const K2 = 'b'.repeat(40);
const ring1 = buildKeyring({ APP_ENCRYPTION_KEY: K1, APP_ENCRYPTION_KEY_VERSION: 1 });
const ring2 = buildKeyring({
  APP_ENCRYPTION_KEY: K2,
  APP_ENCRYPTION_KEY_VERSION: 2,
  APP_ENCRYPTION_KEYS_RETIRED: `1:${K1}`
});
const PLAIN = 'AC-super-secret-token-value';

let tdb: TestDatabase;
let worker: Db;
let app: Db;
const bind = (tenantId: string) => ({ tenantId, provider: 'twilio', name: 'auth_token' });

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  // The shared fixture seeds placeholder rows that are not real ciphertext.
  await tdb.admin`delete from tenant_secrets`;
  worker = createDb(tdb.worker);
  app = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

describe('SEC-T-34 tenant_secrets', () => {
  it('stores ciphertext, never the plaintext', async () => {
    await writeTenantSecret(worker, bind(IDS.tenantA), PLAIN, { keyring: ring1 });
    const rows = await tdb.admin`select ciphertext, nonce, key_version from tenant_secrets`;
    expect(rows).toHaveLength(1);
    expect(Buffer.from(rows[0].ciphertext).toString('utf8')).not.toContain(PLAIN);
    expect(Buffer.from(rows[0].ciphertext).includes(Buffer.from(PLAIN))).toBe(false);
    expect(rows[0].key_version).toBe(1);
    expect(await readTenantSecret(worker, bind(IDS.tenantA), { keyring: ring1 })).toBe(PLAIN);
  });

  it('exposes only set/rotated status to callers that list secrets', async () => {
    const status = await listTenantSecretStatus(worker, IDS.tenantA);
    expect(status).toEqual([
      expect.objectContaining({ provider: 'twilio', name: 'auth_token', isSet: true })
    ]);
    expect(JSON.stringify(status)).not.toContain(PLAIN);
    expect(Object.keys(status[0])).not.toContain('ciphertext');
  });

  it('refuses the web app role any access to the table', async () => {
    await expect(app.execute(sql`select * from tenant_secrets`)).rejects.toThrow();
    await expect(readTenantSecret(app, bind(IDS.tenantA), { keyring: ring1 })).rejects.toThrow();
  });

  it('overwrites on re-write and stamps rotated_at', async () => {
    await writeTenantSecret(worker, bind(IDS.tenantA), 'second-value', { keyring: ring1 });
    const status = await listTenantSecretStatus(worker, IDS.tenantA);
    expect(status).toHaveLength(1);
    expect(status[0].rotatedAt).not.toBeNull();
    expect(await readTenantSecret(worker, bind(IDS.tenantA), { keyring: ring1 })).toBe(
      'second-value'
    );
  });

  it('keeps tenants apart: a row copied to another tenant will not decrypt', async () => {
    await tdb.admin`insert into tenant_secrets (tenant_id, provider, name, ciphertext, nonce, key_version)
      select ${IDS.tenantB}, provider, name, ciphertext, nonce, key_version from tenant_secrets where tenant_id = ${IDS.tenantA}`;
    await expect(readTenantSecret(worker, bind(IDS.tenantB), { keyring: ring1 })).rejects.toThrow(
      /could not be decrypted/
    );
    await tdb.admin`delete from tenant_secrets where tenant_id = ${IDS.tenantB}`;
  });

  it('rotates to the current key version and keeps values readable', async () => {
    expect(await reencryptTenantSecrets(worker, { keyring: ring2 })).toBe(1);
    const rows = await tdb.admin`select key_version from tenant_secrets`;
    expect(rows[0].key_version).toBe(2);
    expect(await readTenantSecret(worker, bind(IDS.tenantA), { keyring: ring2 })).toBe(
      'second-value'
    );
    expect(await reencryptTenantSecrets(worker, { keyring: ring2 })).toBe(0);
  });
});
