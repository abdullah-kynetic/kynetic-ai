import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  isAdminKeyOwner,
  issueAdminKey,
  listAdminKeys,
  revokeAdminKey,
  setServiceApiEnabled
} from '@/server/admin/admin-api-keys';
import { issueAdminServiceToken } from '@/server/admin/service-tokens';
import { authenticateServiceToken, runIdempotent } from '@/server/service-auth';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let test: TestDatabase;
let worker: Db;
const OTHER_ADMIN = 'cccccccc-0000-4000-8000-000000000003';
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const otherAdmin = { id: OTHER_ADMIN, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';
let slugA = '';
let slugB = '';

const req = (headers: Record<string, string>) =>
  new Request('https://portal.test/api/service/x', { headers });

beforeAll(async () => {
  test = await createTestDatabase();
  await seedTwoTenants(test.admin);
  await test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${OTHER_ADMIN}, 'other-admin@example.test', 'admin', true)`;
  await test.admin`update users set email_verified = true where id = ${IDS.admin}`;
  worker = createDb(test.app);
  slugA = (await test.admin`select slug from tenants where id = ${IDS.tenantA}`)[0]!.slug;
  slugB = (await test.admin`select slug from tenants where id = ${IDS.tenantB}`)[0]!.slug;
});
afterAll(async () => {
  await test?.drop();
});

describe('admin API keys', () => {
  it('only the owner can issue, list, revoke or stop the API', async () => {
    const opts = { db: worker, ownerEmail };
    expect(await isAdminKeyOwner(owner, opts)).toBe(true);
    expect(await isAdminKeyOwner(otherAdmin, opts)).toBe(false);
    await expect(
      issueAdminKey(otherAdmin, { label: 'x', allowedCidrs: [] }, opts)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(listAdminKeys(otherAdmin, opts)).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(setServiceApiEnabled(otherAdmin, false, opts)).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(
      issueAdminKey(owner, { label: 'x', allowedCidrs: [] }, { db: worker, ownerEmail: null })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('acts for the client named in the header, with every scope, and nothing else', async () => {
    const opts = { db: worker, ownerEmail };
    const { key, id } = await issueAdminKey(owner, { label: 'agent', allowedCidrs: [] }, opts);
    expect(key).toMatch(/^kad_[0-9a-f]{16}_[0-9a-f]{64}$/);
    const a = await authenticateServiceToken(`Bearer ${key}`, {
      db: worker,
      request: req({ 'x-kynetic-client': slugA })
    });
    expect(a).toMatchObject({ tenantId: IDS.tenantA, tokenId: null, adminKeyId: id });
    expect(a!.scopes).toContain('deals:write');
    const b = await authenticateServiceToken(`Bearer ${key}`, {
      db: worker,
      request: req({ 'x-kynetic-client': slugB })
    });
    expect(b!.tenantId).toBe(IDS.tenantB);
    // No header, unknown client, no request: all 401.
    expect(
      await authenticateServiceToken(`Bearer ${key}`, { db: worker, request: req({}) })
    ).toBeNull();
    expect(
      await authenticateServiceToken(`Bearer ${key}`, {
        db: worker,
        request: req({ 'x-kynetic-client': 'no-such-client' })
      })
    ).toBeNull();
    expect(await authenticateServiceToken(`Bearer ${key}`, { db: worker })).toBeNull();
    // Wrong secret.
    expect(
      await authenticateServiceToken(`Bearer ${key.slice(0, -1)}0`, {
        db: worker,
        request: req({ 'x-kynetic-client': slugA })
      })
    ).toBeNull();
    // Revoked.
    expect(await revokeAdminKey(owner, id, opts)).toBe(true);
    expect(
      await authenticateServiceToken(`Bearer ${key}`, {
        db: worker,
        request: req({ 'x-kynetic-client': slugA })
      })
    ).toBeNull();
  });

  it('locks to the allowed address and fails closed on an unknown one', async () => {
    const { key } = await issueAdminKey(
      owner,
      { label: 'locked', allowedCidrs: ['203.0.113.0/24'] },
      { db: worker, ownerEmail }
    );
    const call = (xff?: string) =>
      authenticateServiceToken(`Bearer ${key}`, {
        db: worker,
        request: req({ 'x-kynetic-client': slugA, ...(xff ? { 'x-forwarded-for': xff } : {}) })
      });
    expect(await call('198.51.100.9, 203.0.113.7')).not.toBeNull();
    expect(await call('203.0.113.7, 198.51.100.9')).toBeNull();
    expect(await call()).toBeNull();
    await expect(
      issueAdminKey(owner, { label: 'bad', allowedCidrs: ['nope'] }, { db: worker, ownerEmail })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('the stop-all switch blocks admin keys and client tokens, and can be turned back on', async () => {
    const opts = { db: worker, ownerEmail };
    const { key } = await issueAdminKey(owner, { label: 'k', allowedCidrs: [] }, opts);
    const t = await issueAdminServiceToken(
      owner,
      IDS.tenantA,
      { label: 't', scopes: ['contacts:read'] },
      opts
    );
    const admin = () =>
      authenticateServiceToken(`Bearer ${key}`, {
        db: worker,
        request: req({ 'x-kynetic-client': slugA })
      });
    const client = () => authenticateServiceToken(`Bearer ${t.token}`, { db: worker });
    expect(await admin()).not.toBeNull();
    expect(await client()).not.toBeNull();
    await setServiceApiEnabled(owner, false, opts);
    expect(await admin()).toBeNull();
    expect(await client()).toBeNull();
    await setServiceApiEnabled(owner, true, opts);
    expect(await admin()).not.toBeNull();
    expect(await client()).not.toBeNull();
  });

  it('writes through an admin key are idempotent and recorded against the key', async () => {
    const { key, id } = await issueAdminKey(
      owner,
      { label: 'idem', allowedCidrs: [] },
      { db: worker, ownerEmail }
    );
    const svc = (await authenticateServiceToken(`Bearer ${key}`, {
      db: worker,
      request: req({ 'x-kynetic-client': slugA })
    }))!;
    const request = new Request('https://portal.test/api/service/notes', {
      method: 'POST',
      headers: { 'idempotency-key': 'admin-key-test-1' }
    });
    let runs = 0;
    const run = () =>
      runIdempotent(
        svc,
        request,
        '{}',
        async () => {
          runs++;
          return { status: 201, body: { ok: true } };
        },
        { db: worker }
      );
    expect((await run()).replayed).toBe(false);
    expect((await run()).replayed).toBe(true);
    expect(runs).toBe(1);
    const rows =
      await test.admin`select token_id, admin_key_id from service_idempotency where key = 'admin-key-test-1'`;
    expect(rows[0]).toMatchObject({ token_id: null, admin_key_id: id });
  });

  it('runtime roles cannot read the key tables directly', async () => {
    await expect(test.app`select * from admin_api_keys`).rejects.toThrow();
    await expect(test.app`select * from service_api_control`).rejects.toThrow();
  });
});
