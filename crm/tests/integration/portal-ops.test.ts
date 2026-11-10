import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { setStorage } from '@/server/adapters/storage';
import { FakeStorage } from '@/server/adapters/storage/fake';
import {
  issueAdminServiceToken,
  listServiceTokens,
  revokeAdminServiceToken
} from '@/server/admin/service-tokens';
import { setN8nPushConfig } from '@/server/admin/lead-webhooks';
import { buildKeyring } from '@/server/secrets/crypto';
import { readTenantSecret } from '@/server/secrets';
import { runRetentionPurge } from '@/server/retention/purge';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let test: TestDatabase;
let worker: Db;
const admin = { id: IDS.admin, kyneticRole: 'admin' as const };
const keyring = buildKeyring({
  APP_ENCRYPTION_KEY: 'synthetic-test-key-not-real-000000000000',
  APP_ENCRYPTION_KEY_VERSION: 1
});
const storage = new FakeStorage();

beforeAll(async () => {
  test = await createTestDatabase();
  await seedTwoTenants(test.admin);
  worker = createDb(test.worker);
  setStorage(storage);
});

afterAll(async () => {
  setStorage(undefined);
  await test?.drop();
});

describe('admin service tokens', () => {
  it('issues, lists and revokes without storing or returning the secret twice', async () => {
    const issued = await issueAdminServiceToken(
      admin,
      IDS.tenantA,
      { label: 'n8n lead', scopes: ['contacts:read', 'event-ack'] },
      { db: worker }
    );
    const secret = issued.token.split('_')[2] ?? '';
    const [row] =
      await test.admin`select key_hash, prefix from service_tokens where id = ${issued.id}`;
    expect(row.key_hash).not.toContain(secret);
    expect(JSON.stringify(row)).not.toContain(secret);
    const listed = await listServiceTokens(admin, IDS.tenantA, { db: worker });
    const saved = listed.find((item) => item.id === issued.id);
    expect(saved).toMatchObject({
      label: 'n8n lead',
      scopes: ['contacts:read', 'event-ack'],
      revokedAt: null
    });
    expect(JSON.stringify(listed)).not.toContain(secret);
    expect(JSON.stringify(listed)).not.toContain(row.key_hash);
    await expect(
      listServiceTokens({ id: IDS.va, kyneticRole: 'va' }, IDS.tenantA, { db: worker })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(await revokeAdminServiceToken(admin, IDS.tenantB, issued.id, { db: worker })).toEqual({
      revoked: false
    });
    expect(await revokeAdminServiceToken(admin, IDS.tenantA, issued.id, { db: worker })).toEqual({
      revoked: true
    });
    const audits = await test.admin`
      select action from audit_log
      where tenant_id = ${IDS.tenantA} and action like 'service_token.%'
      order by created_at`;
    expect(audits.map((row) => row.action)).toEqual([
      'service_token.issue',
      'service_token.list',
      'service_token.revoke'
    ]);
    expect(JSON.stringify(audits)).not.toContain(secret);
  });
});

describe('n8n push settings', () => {
  it('encrypts the secret, strips plaintext, and does not return the secret', async () => {
    const secret = 'synthetic-n8n-push-secret';
    await test.admin`update tenant_modules set config = ${test.admin.json({
      n8nWebhookSecret: secret,
      reportDayOfMonth: 3
    })} where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    const saved = await setN8nPushConfig(
      admin,
      IDS.tenantA,
      { url: 'https://n8n.example.test/hooks/events', secret },
      { db: worker, keyring }
    );
    expect(saved).toEqual({
      url: 'https://n8n.example.test/hooks/events',
      secretWritten: true
    });
    expect(JSON.stringify(saved)).not.toContain(secret);
    const [config] = await test.admin`
      select config from tenant_modules where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    expect(config.config.n8nWebhookUrl).toBe('https://n8n.example.test/hooks/events');
    expect(config.config.n8nWebhookSecret).toBeUndefined();
    expect(config.config.reportDayOfMonth).toBe(3);
    const opened = await readTenantSecret(
      worker,
      { tenantId: IDS.tenantA, provider: 'n8n', name: 'event_webhook' },
      { keyring }
    );
    expect(opened).toBe(secret);
    const stored = await test.admin`
      select ciphertext from tenant_secrets
      where tenant_id = ${IDS.tenantA} and provider = 'n8n' and name = 'event_webhook'`;
    expect(Buffer.from(stored[0]!.ciphertext).includes(Buffer.from(secret))).toBe(false);
    await expect(
      setN8nPushConfig(
        admin,
        IDS.tenantA,
        { url: 'https://user:secret@n8n.example.test/hooks', secret: 'another-secret-value' },
        { db: worker, keyring }
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('retention purge', () => {
  it('clears expired tenant data and leaves the other tenant and fresh rows', async () => {
    const recordingKey = `${IDS.tenantA}/calls/recording.bin`;
    await storage.put(recordingKey, new TextEncoder().encode('audio'));
    await test.admin`
      update calls set purge_after = now() - interval '1 day', transcript = 'spoken words',
        recording_key = ${recordingKey}
      where tenant_id = ${IDS.tenantA}`;
    await test.admin`
      insert into messages (tenant_id, contact_id, channel, direction, actor_type, from_address, to_address, body, status, created_at)
      select tenant_id, id, 'sms', 'outbound', 'alex', '+15555550100', '+15555550101', 'old body', 'sent', now() - interval '25 months'
      from contacts where tenant_id = ${IDS.tenantB} limit 1`;
    await test.admin`
      insert into consents (tenant_id, contact_id, channel, kind, source, captured_text, captured_at, revoked_at)
      select tenant_id, id, 'email', 'express_written', 'form', 'keep this grant', now() - interval '6 years', now() - interval '6 years'
      from contacts where tenant_id = ${IDS.tenantA} limit 1`;
    await test.admin`
      insert into consents (tenant_id, contact_id, channel, kind, source, captured_at, revoked_at)
      select tenant_id, id, 'email', 'opt_out', 'email_link', now() - interval '1 year', now() - interval '10 days'
      from contacts where tenant_id = ${IDS.tenantA} limit 1`;
    const importKey = `${IDS.tenantA}/imports/old.csv`;
    await storage.put(importKey, new TextEncoder().encode('a,b'));
    await test.admin`
      update import_batches set committed_at = now() - interval '40 days', file_key = ${importKey}
      where tenant_id = ${IDS.tenantA}`;
    await test.admin`
      update webhook_events set payload = ${test.admin.json({ phone: '+15555550199' })},
        received_at = now() - interval '40 days'
      where tenant_id = ${IDS.tenantA}`;

    const first = await runRetentionPurge({ db: worker, now: new Date('2026-11-10T12:00:00Z') });
    expect(first.callsCleared).toBeGreaterThan(0);
    expect(first.consentsDeleted).toBe(1);
    expect(first.importFilesDeleted).toBe(1);
    expect(first.webhookPayloadsCleared).toBe(1);
    expect(first.messagesDeleted).toBe(1);
    const second = await runRetentionPurge({ db: worker, now: new Date('2026-11-10T12:00:00Z') });
    expect(second).toMatchObject({
      callsCleared: 0,
      messagesDeleted: 0,
      consentsDeleted: 0,
      importFilesDeleted: 0,
      webhookPayloadsCleared: 0
    });

    const [call] = await test.admin`
      select transcript, recording_key from calls where tenant_id = ${IDS.tenantA}`;
    expect(call.transcript).toBeNull();
    expect(call.recording_key).toBeNull();
    expect(await storage.get(recordingKey)).toBeNull();
    const kept = await test.admin`
      select captured_text from consents
      where tenant_id = ${IDS.tenantA} and channel = 'email' and kind = 'opt_out'`;
    expect(kept).toHaveLength(1);
    const [freshMessage] = await test.admin`
      select count(*)::int as n from messages where tenant_id = ${IDS.tenantA} and created_at > now() - interval '1 day'`;
    expect(freshMessage.n).toBeGreaterThan(0);
    const [batch] = await test.admin`
      select file_key from import_batches where tenant_id = ${IDS.tenantA}`;
    expect(batch.file_key).toBeNull();
    const [event] = await test.admin`
      select payload from webhook_events where tenant_id = ${IDS.tenantA}`;
    expect(event.payload).toEqual({});
    const audits = await test.admin`
      select after from audit_log where action = 'retention.purge' and tenant_id = ${IDS.tenantA}`;
    expect(JSON.stringify(audits)).not.toContain('spoken words');
    expect(JSON.stringify(audits)).not.toContain('old body');
    const [auditRow] = await test.admin`select count(*)::int as n from audit_log`;
    expect(auditRow.n).toBeGreaterThan(0);
  });
});
