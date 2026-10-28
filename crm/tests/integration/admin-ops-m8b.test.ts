import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { calculateHealthScore, listAdminTenantOverview, listFlaggedCalls, listIntegrationHealth, markFlaggedCallReviewed, placeAdminTestCall, replayWebhook, setOutboundKillSwitch, suspendTenant, updateAdminAlexConfig } from '@/server/admin';
import { FakeVoiceProvider } from '@/server/adapters/voice/fake';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
const admin = { userId: IDS.admin, role: 'admin' as const };
const platform = { userId: IDS.admin, role: 'admin' as const };

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => { await tdb?.drop(); });

describe('M8b local admin operations acceptance', () => {
  it('F-53/F-54 lists tenant rollups and calculates hand-checked health scores and thresholds', async () => {
    const rows = await listAdminTenantOverview(platform, { db });
    expect(rows.map((row) => row.tenantId).sort()).toEqual([IDS.tenantA, IDS.tenantB].sort());
    expect(rows.every((row) => !('ownerEmail' in row))).toBe(true);
    expect(calculateHealthScore({ bookingRate: 0.5, leads30d: 10, integrationErrors: 2, lastLoginAt: '2026-10-27T12:00:00.000Z', now: new Date('2026-10-28T12:00:00.000Z') })).toBe(76);
    expect(calculateHealthScore({ bookingRate: 0, leads30d: 0, integrationErrors: 10, lastLoginAt: null, now: new Date('2026-10-28T12:00:00.000Z') })).toBe(0);
    await expect(listAdminTenantOverview({ userId: IDS.ownerA, role: 'owner' as never }, { db })).rejects.toThrow();
  });

  it('F-62 returns integration errors and phone-number A2P status through the staff rollup', async () => {
    await tdb.admin`insert into integrations (tenant_id, kind, status, last_error_at, last_error, error_count)
      values (${IDS.tenantA}, 'sms', 'degraded', now(), 'synthetic provider timeout', 3)`;
    await tdb.admin`insert into phone_numbers (tenant_id, e164, provider, provider_sid, purpose, a2p_status)
      values (${IDS.tenantA}, '+15555550199', 'twilio', 'PN_SYNTHETIC_A', 'sms', 'pending')`;
    const rows = await listIntegrationHealth(platform, { db });
    const sms = rows.find((row) => row.tenantId === IDS.tenantA && row.kind === 'sms');
    expect(sms).toMatchObject({ status: 'degraded', lastError: 'synthetic provider timeout', errorCount: 3 });
    expect(sms?.a2pStatus.split(',')).toContain('pending');
    await expect(listIntegrationHealth({ userId: IDS.ownerA, role: 'owner' as never }, { db })).rejects.toThrow();
  });

  it('F-28 staff flagged-call list isolates pending reviews and marks a review once', async () => {
    const [{ contactId }] = await tdb.admin`select id as "contactId" from contacts where tenant_id = ${IDS.tenantA} limit 1`;
    const [{ id }] = await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, flagged, flagged_at, flag_note)
      values (${IDS.tenantA}, ${contactId}, 'fake', 'synthetic-review-call', 'inbound', now(), true, now(), 'Synthetic review reason') returning id`;
    const pending = await listFlaggedCalls(platform, { db });
    expect(pending).toContainEqual(expect.objectContaining({ callId: id, tenantId: IDS.tenantA, flagNote: 'Synthetic review reason' }));
    await expect(markFlaggedCallReviewed(admin, { tenantId: IDS.tenantA, callId: id }, { db })).resolves.toBe(true);
    expect(await listFlaggedCalls(platform, { db })).not.toContainEqual(expect.objectContaining({ callId: id }));
    expect(await tdb.admin`select action, actor_user_id from audit_log where action = 'call.flag_reviewed' and entity_id = ${id}`).toEqual([{ action: 'call.flag_reviewed', actor_user_id: IDS.admin }]);
  });

  it('F-58 admin Alex changes are audited and test calls use the injected fake provider only', async () => {
    await tdb.admin`update alex_configs set provider = 'elevenlabs', agent_ref = 'synthetic-agent', paused = true where tenant_id = ${IDS.tenantA}`;
    await updateAdminAlexConfig({ tenantId: IDS.tenantA, userId: IDS.admin }, { paused: false, prompt: 'Synthetic prompt version' }, { db });
    const fake = new FakeVoiceProvider();
    const result = await placeAdminTestCall({ tenantId: IDS.tenantA, userId: IDS.admin }, '+15555550123', { db, provider: fake });
    expect(result.providerCallId).toBe('fake_call_1');
    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]).toMatchObject({ tenantId: 'test', toE164: '+15555550123', agentId: 'synthetic-agent' });
    expect(await tdb.admin`select action, actor_user_id from audit_log where tenant_id = ${IDS.tenantA} and action in ('alex.settings.admin_update', 'alex.test_call') order by action`)
      .toEqual(expect.arrayContaining([{ action: 'alex.settings.admin_update', actor_user_id: IDS.admin }, { action: 'alex.test_call', actor_user_id: IDS.admin }]));
    expect(await tdb.admin`select version, body from alex_prompts where tenant_id = ${IDS.tenantA} and is_active`).toEqual([{ version: 2, body: 'Synthetic prompt version' }]);
  });

  it('F-101 applies the kill switch, replays a processed webhook once, and suspends/resumes a tenant', async () => {
    await setOutboundKillSwitch(admin, IDS.tenantA, true, { db });
    expect(await tdb.admin`select config->>'outbound_kill_switch' as enabled from tenant_modules where tenant_id = ${IDS.tenantA} and module_key = 'platform'`).toEqual([{ enabled: 'true' }]);
    await setOutboundKillSwitch(admin, IDS.tenantA, false, { db });
    const [{ id }] = await tdb.admin`insert into webhook_events (source, external_id, tenant_id, payload, processed_at, last_error)
      values ('synthetic-m8b', 'event-replay-once', ${IDS.tenantA}, '{}'::jsonb, now(), 'synthetic failure') returning id`;
    await expect(replayWebhook(admin, id, { db })).resolves.toEqual({ replayed: true });
    await expect(replayWebhook(admin, id, { db })).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(await tdb.admin`select processed_at, last_error from webhook_events where id = ${id}`).toMatchObject([{ processed_at: null, last_error: null }]);
    await suspendTenant(admin, IDS.tenantA, true, { db });
    expect(await tdb.admin`select status from tenants where id = ${IDS.tenantA}`).toEqual([{ status: 'suspended' }]);
    await suspendTenant(admin, IDS.tenantA, false, { db });
    expect(await tdb.admin`select status from tenants where id = ${IDS.tenantA}`).toEqual([{ status: 'active' }]);
  });
});
