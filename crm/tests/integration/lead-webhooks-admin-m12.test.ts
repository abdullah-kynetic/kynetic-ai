import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { getLeadWebhookSettings, rotateLeadWebhookSecret } from '@/server/admin/lead-webhooks';
import { buildKeyring } from '@/server/secrets/crypto';
import { readTenantSecret } from '@/server/secrets';
import { signLeadBody, verifyLeadSignature } from '@/server/leads';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
const caller = { id: IDS.admin, kyneticRole: 'admin' as const };
const keyring = buildKeyring({
  APP_ENCRYPTION_KEY: 'synthetic-test-key-not-real-000000000000',
  APP_ENCRYPTION_KEY_VERSION: 1
});
const opts = () => ({ db, keyring });
const binding = (tenantId: string) => ({
  tenantId,
  provider: 'lead_webhook',
  name: 'signing_secret'
});
beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  await tdb.admin`delete from tenant_secrets`;
  db = createDb(tdb.worker);
  await tdb.admin`update tenant_modules set config = ${tdb.admin.json({ n8nWebhookUrl: 'https://n8n.example.test/webhook/synthetic', n8nWebhookSecret: 'synthetic-must-not-return' })}
    where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
});
afterAll(async () => {
  await tdb?.drop();
});

describe('M12-05 F-76/F-87 admin lead webhook settings', () => {
  it('returns only safe status and the tenant URLs, never configured secrets', async () => {
    const settings = await getLeadWebhookSettings(caller, IDS.tenantA, opts());
    expect(settings).toEqual({
      tenantId: IDS.tenantA,
      leadPath: `/api/hooks/leads/${IDS.tenantA}`,
      n8nUrl: 'https://n8n.example.test/webhook/synthetic',
      n8nSecret: { isSet: false, rotatedAt: null },
      secret: { isSet: false, rotatedAt: null }
    });
    expect(JSON.stringify(settings)).not.toContain('synthetic-must-not-return');
  });
  it('issues/rotates encrypted values, shows them only in the issuing response, and invalidates old signatures', async () => {
    const first = await rotateLeadWebhookSecret(caller, IDS.tenantA, opts());
    expect(first.secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const second = await rotateLeadWebhookSecret(caller, IDS.tenantA, opts());
    expect(second.secret).not.toBe(first.secret);
    const current = await readTenantSecret(db, binding(IDS.tenantA), { keyring });
    expect(current).toBe(second.secret);
    const now = new Date('2026-11-01T12:00:00Z');
    const timestamp = String(now.getTime() / 1000);
    const rawBody = '{"synthetic":true}';
    expect(
      verifyLeadSignature({
        secret: current!,
        timestamp,
        signature: signLeadBody(first.secret, timestamp, rawBody),
        rawBody,
        now
      })
    ).toBe(false);
    expect(
      verifyLeadSignature({
        secret: current!,
        timestamp,
        signature: signLeadBody(second.secret, timestamp, rawBody),
        rawBody,
        now
      })
    ).toBe(true);
    const settings = await getLeadWebhookSettings(caller, IDS.tenantA, opts());
    expect(settings.secret.isSet).toBe(true);
    expect(JSON.stringify(settings)).not.toContain(second.secret);
    const rows =
      await tdb.admin`select ciphertext from tenant_secrets where tenant_id = ${IDS.tenantA}`;
    expect(Buffer.from(rows[0]!.ciphertext).includes(Buffer.from(second.secret))).toBe(false);
    const audits =
      await tdb.admin`select * from audit_log where action = 'lead_webhook.secret.rotate'`;
    expect(audits).toHaveLength(2);
    expect(JSON.stringify(audits)).not.toContain(first.secret);
    expect(JSON.stringify(audits)).not.toContain(second.secret);
    expect(
      audits.every((row) => row.actor_user_id === IDS.admin && row.tenant_id === IDS.tenantA)
    ).toBe(true);
    expect(await readTenantSecret(db, binding(IDS.tenantB), { keyring })).toBeNull();
  });
  it('refuses VA, client, forged-role and disabled-admin callers', async () => {
    for (const actor of [
      { id: IDS.va, kyneticRole: 'va' as const },
      { id: IDS.ownerA, kyneticRole: null },
      { id: IDS.ownerA, kyneticRole: 'admin' as const }
    ]) {
      await expect(getLeadWebhookSettings(actor, IDS.tenantA, opts())).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      await expect(rotateLeadWebhookSecret(actor, IDS.tenantA, opts())).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
    }
    await tdb.admin`update users set disabled_at = now() where id = ${IDS.admin}`;
    try {
      await expect(rotateLeadWebhookSecret(caller, IDS.tenantA, opts())).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
    } finally {
      await tdb.admin`update users set disabled_at = null where id = ${IDS.admin}`;
    }
  });
  it('rejects unknown tenants before issuing anything', async () => {
    for (const tenant of ['invalid', crypto.randomUUID()]) {
      await expect(rotateLeadWebhookSecret(caller, tenant, opts())).rejects.toMatchObject({
        code: 'NOT_FOUND'
      });
    }
  });
  it('does not expose URLs containing credentials or query tokens', async () => {
    for (const url of [
      'https://user:synthetic@n8n.example.test/hook',
      'https://n8n.example.test/hook?token=synthetic',
      'javascript:alert(1)'
    ]) {
      await tdb.admin`update tenant_modules set config = ${tdb.admin.json({ n8nWebhookUrl: url })} where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
      expect((await getLeadWebhookSettings(caller, IDS.tenantA, opts())).n8nUrl).toBeNull();
    }
  });
  it('rolls back rotation if audit persistence fails', async () => {
    const before = await readTenantSecret(db, binding(IDS.tenantA), { keyring });
    await tdb.admin
      .unsafe(`CREATE FUNCTION reject_secret_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action = 'lead_webhook.secret.rotate' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_secret_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_secret_audit();`);
    try {
      await expect(rotateLeadWebhookSecret(caller, IDS.tenantA, opts())).rejects.toThrow();
    } finally {
      await tdb.admin.unsafe(
        'DROP TRIGGER reject_secret_audit ON audit_log; DROP FUNCTION reject_secret_audit();'
      );
    }
    expect(await readTenantSecret(db, binding(IDS.tenantA), { keyring })).toBe(before);
  });
});
