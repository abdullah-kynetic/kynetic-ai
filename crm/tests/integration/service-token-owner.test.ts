import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  isServiceApiOwner,
  issueAdminServiceToken,
  listServiceTokens,
  revokeAdminServiceToken
} from '@/server/admin/service-tokens';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

// Only the portal owner manages service tokens (the API and MCP keys), not every Kynetic admin.

let test: TestDatabase;
let worker: Db;
const OTHER_ADMIN = 'cccccccc-0000-4000-8000-000000000003';
const UNVERIFIED_ADMIN = 'cccccccc-0000-4000-8000-000000000004';
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const otherAdmin = { id: OTHER_ADMIN, kyneticRole: 'admin' as const };
const unverified = { id: UNVERIFIED_ADMIN, kyneticRole: 'admin' as const };
const va = { id: IDS.va, kyneticRole: 'va' as const };
const ownerEmail = 'admin@example.test';
const input = { label: 'agent', scopes: ['contacts:read'] };

const tokenCount = async () =>
  ((await test.admin`select count(*)::int as n from service_tokens`)[0] as { n: number }).n;
const tokenAudits = async () =>
  (
    (
      await test.admin`select count(*)::int as n from audit_log where action like 'service_token.%'`
    )[0] as { n: number }
  ).n;

beforeAll(async () => {
  test = await createTestDatabase();
  await seedTwoTenants(test.admin);
  await test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${OTHER_ADMIN}, 'other-admin@example.test', 'admin', true),
    (${UNVERIFIED_ADMIN}, 'unverified-admin@example.test', 'admin', false)`;
  await test.admin`update users set email_verified = true where id in (${IDS.admin}, ${IDS.va})`;
  worker = createDb(test.worker);
});
afterAll(async () => {
  await test?.drop();
});

describe('service token management is owner only', () => {
  it('the owner can issue, list and revoke', async () => {
    const issued = await issueAdminServiceToken(owner, IDS.tenantA, input, {
      db: worker,
      ownerEmail
    });
    expect(issued.token).toMatch(/^kst_/);
    const listed = await listServiceTokens(owner, IDS.tenantA, { db: worker, ownerEmail });
    expect(listed.map((t) => t.id)).toContain(issued.id);
    expect(
      await revokeAdminServiceToken(owner, IDS.tenantA, issued.id, { db: worker, ownerEmail })
    ).toEqual({ revoked: true });
  });

  it('the email match ignores case and spaces', async () => {
    for (const value of ['ADMIN@Example.test', '  admin@example.test  ']) {
      await expect(
        listServiceTokens(owner, IDS.tenantA, { db: worker, ownerEmail: value })
      ).resolves.toBeDefined();
    }
  });

  it('another Kynetic admin cannot issue, list or revoke, and nothing is written', async () => {
    const live = await issueAdminServiceToken(owner, IDS.tenantA, input, {
      db: worker,
      ownerEmail
    });
    const tokens = await tokenCount();
    const audits = await tokenAudits();
    const opts = { db: worker, ownerEmail };
    await expect(
      issueAdminServiceToken(otherAdmin, IDS.tenantA, input, opts)
    ).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(listServiceTokens(otherAdmin, IDS.tenantA, opts)).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(
      revokeAdminServiceToken(otherAdmin, IDS.tenantA, live.id, opts)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await tokenCount()).toBe(tokens);
    expect(await tokenAudits()).toBe(audits);
    const [row] = await test.admin`select revoked_at from service_tokens where id = ${live.id}`;
    expect(row!.revoked_at).toBeNull();
  });

  it('a VA cannot, even with the owner email configured', async () => {
    await expect(
      listServiceTokens(va, IDS.tenantA, { db: worker, ownerEmail: 'va@example.test' })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('an owner email that is not verified cannot manage tokens', async () => {
    await expect(
      issueAdminServiceToken(unverified, IDS.tenantA, input, {
        db: worker,
        ownerEmail: 'unverified-admin@example.test'
      })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('fails closed: no owner configured means nobody can, not even an admin', async () => {
    const tokens = await tokenCount();
    for (const value of [null, '', '   ']) {
      const opts = { db: worker, ownerEmail: value };
      await expect(issueAdminServiceToken(owner, IDS.tenantA, input, opts)).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      await expect(listServiceTokens(owner, IDS.tenantA, opts)).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
    }
    expect(await tokenCount()).toBe(tokens);
  });

  it('a disabled owner account cannot manage tokens', async () => {
    await test.admin`update users set disabled_at = now() where id = ${IDS.admin}`;
    try {
      await expect(
        listServiceTokens(owner, IDS.tenantA, { db: worker, ownerEmail })
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    } finally {
      await test.admin`update users set disabled_at = null where id = ${IDS.admin}`;
    }
  });

  it('isServiceApiOwner says true only for the owner', async () => {
    const opts = { db: worker, ownerEmail };
    expect(await isServiceApiOwner(owner, IDS.tenantA, opts)).toBe(true);
    expect(await isServiceApiOwner(otherAdmin, IDS.tenantA, opts)).toBe(false);
    expect(await isServiceApiOwner(va, IDS.tenantA, opts)).toBe(false);
    expect(await isServiceApiOwner(owner, IDS.tenantA, { db: worker, ownerEmail: null })).toBe(
      false
    );
  });

  it('tokens issued earlier keep working after a non-owner is refused', async () => {
    const live = await issueAdminServiceToken(owner, IDS.tenantA, input, {
      db: worker,
      ownerEmail
    });
    await expect(
      revokeAdminServiceToken(otherAdmin, IDS.tenantA, live.id, { db: worker, ownerEmail })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const [row] = await test.admin`select revoked_at from service_tokens where id = ${live.id}`;
    expect(row!.revoked_at).toBeNull();
  });
});
