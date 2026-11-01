import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GET as sendStateRoute } from '@/app/api/service/send-state/route';
import { GET as policyRoute } from '@/app/api/service/contact-policy/[contactId]/route';
import { readContactPolicy, readSendState } from '@/server/contact-policy';
import { createDb, type Db } from '@/server/db/client';
import { issueServiceToken, revokeServiceToken } from '@/server/service-auth';
import { setOutboundKillSwitch } from '@/server/admin/operations-tools';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
let b: Awaited<ReturnType<typeof seedTwoTenants>>['b'];
let token: string;
const at = new Date('2026-11-01T18:00:00Z');
const svc = {
  tenantId: IDS.tenantA,
  tokenId: crypto.randomUUID(),
  scopes: ['send-state:read', 'contact-policy:read']
};
const request = (value = token) =>
  new Request('http://localhost/api/service/send-state', {
    headers: { authorization: `Bearer ${value}` }
  });
const policy = (id = a.contactId, value = token) =>
  policyRoute(request(value), { params: Promise.resolve({ contactId: id }) });
const opts = () => ({ db, now: at, outboundEnabled: true });
beforeAll(async () => {
  tdb = await createTestDatabase();
  ({ a, b } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'synthetic-auth-key-for-policy-test-000000',
    APP_ENCRYPTION_KEY: 'synthetic-encryption-for-policy-0000000',
    OUTBOUND_ENABLED: 'false'
  });
  token = (
    await issueServiceToken(
      ctx.ownerA(),
      { label: 'synthetic n8n policy', scopes: svc.scopes },
      { db }
    )
  ).token;
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});
describe('M12-04/M12-06 F-74/F-89 policy readers', () => {
  it('exposes fresh no-store snapshots and defaults the global switch to blocked', async () => {
    const response = await sendStateRoute(request());
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect((await response.json()).data).toMatchObject({ globalKillSwitch: true, blocked: true });
    expect(await readSendState(svc, opts())).toMatchObject({
      checkedAt: at.toISOString(),
      blocked: false
    });
  });
  it('reflects the existing admin tenant/global controls immediately and isolates tenants', async () => {
    await setOutboundKillSwitch({ userId: IDS.admin, role: 'admin' }, IDS.tenantA, true, { db });
    expect(await readSendState(svc, opts())).toMatchObject({
      tenantKillSwitch: true,
      blocked: true
    });
    expect(await readSendState({ ...svc, tenantId: IDS.tenantB }, opts())).toMatchObject({
      tenantKillSwitch: false
    });
    await setOutboundKillSwitch({ userId: IDS.admin, role: 'admin' }, null, true, { db });
    expect((await readSendState({ ...svc, tenantId: IDS.tenantB }, opts())).blocked).toBe(true);
    await setOutboundKillSwitch({ userId: IDS.admin, role: 'admin' }, null, false, { db });
  });
  it('fails closed on malformed/missing configuration, suspension and offboarding', async () => {
    await tdb.admin`update tenant_modules set config = ${tdb.admin.json({ outbound_kill_switch: 'false' })} where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    expect(await readSendState(svc, opts())).toMatchObject({
      configurationValid: false,
      blocked: true
    });
    await tdb.admin`update tenant_modules set config = '{}' where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    for (const status of ['suspended', 'offboarded']) {
      await tdb.admin`update tenants set status = ${status} where id = ${IDS.tenantA}`;
      expect((await readSendState(svc, opts())).blocked).toBe(true);
    }
    await tdb.admin`update tenants set status = 'active' where id = ${IDS.tenantA}`;
    await tdb.admin`delete from tenant_modules where tenant_id = ${IDS.tenantA} and module_key = 'platform'`;
    expect(await readSendState(svc, opts())).toMatchObject({
      configurationValid: false,
      blocked: true
    });
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'platform', true)`;
  });
  it('returns scoped consent/DNC/state/count inputs without PII, secret values or side effects', async () => {
    await tdb.admin`update contacts set timezone = 'America/New_York', address = '{"state":"FL"}' where id = ${a.contactId}`;
    await tdb.admin`insert into dnc_entries (tenant_id, e164, contact_id, source) values (${IDS.tenantA}, '+15555550101', ${a.contactId}, 'manual')`;
    await tdb.admin`insert into consents (tenant_id, contact_id, channel, kind, source, captured_text, captured_at)
      values (${IDS.tenantA}, ${a.contactId}, 'sms', 'opt_out', 'sms_keyword', 'synthetic-private-wording', ${at.toISOString()})`;
    const [before] = await tdb.admin`select count(*) as n from activities`;
    const snapshot = await readContactPolicy(svc, a.contactId, opts());
    expect(snapshot).toMatchObject({
      contactId: a.contactId,
      timezone: 'America/New_York',
      state: 'FL',
      internalDnc: true,
      migrationGatePassed: false,
      rules: { reviewedByCounsel: false, stateWindow: { startMinute: 480, endMinute: 1200 } },
      calls: { caps: { perDay: 3, perWeek: 6 }, tenantHourlyCap: null }
    });
    expect(snapshot.consent.sms[0]).toMatchObject({
      kind: 'opt_out',
      source: 'sms_keyword',
      evidenceRecorded: true
    });
    const text = JSON.stringify(snapshot);
    for (const value of [
      'synthetic-private-wording',
      '+15555550101',
      'lead-a@example.test',
      'ciphertext',
      'n8nWebhookSecret'
    ])
      expect(text).not.toContain(value);
    const [after] = await tdb.admin`select count(*) as n from activities`;
    expect(after).toEqual(before);
    expect((await policy()).headers.get('cache-control')).toBe('no-store');
  });
  it('rejects foreign, invalid and deleted contacts without leaking policy state', async () => {
    for (const id of [b.contactId, crypto.randomUUID(), 'invalid'])
      expect((await policy(id)).status).toBe(404);
    await tdb.admin`update contacts set deleted_at = now() where id = ${a.contactId}`;
    expect((await policy()).status).toBe(404);
    await tdb.admin`update contacts set deleted_at = null where id = ${a.contactId}`;
  });
  it('requires the correct scope and refuses revoked tokens for both routes', async () => {
    const limited = await issueServiceToken(
      ctx.ownerA(),
      { label: 'wrong scope', scopes: ['contacts:read'] },
      { db }
    );
    const revoked = await issueServiceToken(
      ctx.ownerA(),
      { label: 'revoked', scopes: svc.scopes },
      { db }
    );
    await revokeServiceToken(ctx.ownerA(), revoked.id, { db });
    for (const bad of ['', limited.token, revoked.token]) {
      expect((await sendStateRoute(request(bad))).status).toBe(401);
      expect((await policy(a.contactId, bad)).status).toBe(401);
    }
    await expect(readSendState({ ...svc, scopes: [] }, opts())).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });
});
