import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { POST } from '@/app/api/service/call-results/route';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { FakeVoiceProvider } from '@/server/adapters/voice/fake';
import { createVoiceProcessor, getCallDetail, getCallRecordingUrl } from '@/server/calls';
import { createDb, type Db } from '@/server/db/client';
import { callResultReceipts } from '@/server/db/schema';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken, revokeServiceToken } from '@/server/service-auth';
import { withTenant } from '@/server/tenancy';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let tokenA: string;
let tokenB: string;
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
let b: Awaited<ReturnType<typeof seedTwoTenants>>['b'];
const actor = (which: 'a' | 'b') => ({
  userId: which === 'a' ? IDS.ownerA : IDS.ownerB,
  kyneticRole: null,
  membership: {
    tenantId: which === 'a' ? IDS.tenantA : IDS.tenantB,
    role: 'owner' as const,
    canExport: true,
    canBulkDelete: true
  },
  viewAs: null
});
const input = () => ({
  eventId: crypto.randomUUID(),
  version: 1,
  occurredAt: '2026-11-01T19:00:00.000Z',
  payload: {
    contactId: a.contactId,
    provider: 'elevenlabs',
    providerCallId: `synthetic_${crypto.randomUUID()}`,
    agentId: 'agent_synthetic_a',
    direction: 'outbound',
    startedAt: '2026-11-01T18:00:00.000Z',
    durationS: 60,
    outcome: 'booked',
    sentiment: 'positive',
    transcript: 'Alex: This call is recorded.\nLead: Yes.',
    summary: 'Synthetic booking',
    recordingKey: `${IDS.tenantA}/calls/synthetic-audio/recording`
  }
});
const post = (body: unknown, token = tokenA) =>
  POST(
    new Request('http://localhost/api/service/call-results', {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify(body)
    })
  );
beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'synthetic-auth-call-result-000000000000',
    APP_ENCRYPTION_KEY: 'synthetic-encryption-call-result-000000',
    OUTBOUND_ENABLED: 'false'
  });
  await tdb.admin`update alex_configs set provider = 'elevenlabs', agent_ref = 'agent_synthetic_a' where tenant_id = ${IDS.tenantA}`;
  await tdb.admin`update alex_configs set provider = 'elevenlabs', agent_ref = 'agent_synthetic_b' where tenant_id = ${IDS.tenantB}`;
  await tdb.admin`update tenants set recording_disclosure = 'This call is recorded.' where id = ${IDS.tenantA}`;
  tokenA = (
    await issueServiceToken(
      ctx.ownerA(),
      { label: 'synthetic relay', scopes: ['calls:write'] },
      { db }
    )
  ).token;
  tokenB = (
    await issueServiceToken(
      ctx.ownerB(),
      { label: 'synthetic relay', scopes: ['calls:write'] },
      { db }
    )
  ).token;
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await stopJobs();
  await tdb?.drop();
});
describe('M13-03 F-26/F-27/F-77/F-89 normalized relay', () => {
  it('shows a fake call on the lead timeline/detail with a signed tenant recording link', async () => {
    const body = input();
    const response = await post(body);
    expect(response.status).toBe(201);
    expect(response.headers.get('cache-control')).toBe('no-store');
    const { data } = await response.json();
    const detail = await getCallDetail(actor('a'), ctx.ownerA(), data.callId);
    expect(detail).toMatchObject({
      contactId: a.contactId,
      outcome: 'booked',
      durationS: 60,
      summary: 'Synthetic booking',
      hasRecording: true,
      disclosureGiven: true
    });
    const storage = new FakeStorage();
    await storage.put(body.payload.recordingKey, new Uint8Array([1, 2, 3]));
    expect(
      (await getCallRecordingUrl(actor('a'), ctx.ownerA(), data.callId, storage)).url
    ).toContain('synthetic-audio');
    await expect(
      getCallRecordingUrl(actor('b'), ctx.ownerB(), data.callId, storage)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(
      await tdb.admin`select id from activities where ref_table = 'calls' and ref_id = ${data.callId} and contact_id = ${a.contactId}`
    ).toHaveLength(1);
  });
  it('records one call/activity/completed event across concurrent retries and rejects changed evidence', async () => {
    const body = input();
    const responses = await Promise.all([post(body), post(body), post(body)]);
    expect(responses.map((r) => r.status).toSorted()).toEqual([200, 200, 201]);
    const { data } = await responses[0]!.json();
    expect(
      await tdb.admin`select id from calls where provider_call_id = ${body.payload.providerCallId}`
    ).toHaveLength(1);
    expect(
      await tdb.admin`select id from activities where ref_table = 'calls' and ref_id = ${data.callId}`
    ).toHaveLength(1);
    expect(
      await tdb.admin`select id from pgboss.job where name = 'event.dispatch' and data->>'name' = 'call.completed' and data->'payload'->>'callId' = ${data.callId}`
    ).toHaveLength(1);
    expect((await post({ ...body, payload: { ...body.payload, outcome: 'dnc' } })).status).toBe(
      409
    );
    expect((await post({ ...body, eventId: crypto.randomUUID() })).status).toBe(409);
  });
  it('rejects concurrent event-id reuse for a different call without orphaning rows', async () => {
    const first = input();
    const second = input();
    second.eventId = first.eventId;
    const responses = await Promise.all([post(first), post(second)]);
    expect(responses.map((r) => r.status).toSorted()).toEqual([201, 409]);
    expect(
      await tdb.admin`select id from call_result_receipts where event_id = ${first.eventId}`
    ).toHaveLength(1);
  });
  it('rejects foreign contact/agent/recording references, tenant overrides and provider URLs', async () => {
    const body = input();
    for (const change of [
      { contactId: b.contactId },
      { agentId: 'agent_synthetic_b' },
      { recordingKey: `${IDS.tenantB}/calls/synthetic/recording` },
      { recordingKey: `${IDS.tenantA}/documents/synthetic/recording` }
    ]) {
      expect((await post({ ...body, payload: { ...body.payload, ...change } })).status).toBe(404);
    }
    expect((await post({ ...body, tenantId: IDS.tenantB })).status).toBe(400);
    expect(
      (
        await post({
          ...body,
          payload: { ...body.payload, recordingUrl: 'http://127.0.0.1/private' }
        })
      ).status
    ).toBe(400);
    expect(
      await tdb.admin`select id from call_result_receipts where event_id = ${body.eventId}`
    ).toHaveLength(0);
  });
  it('enforces enabled/disabled module states independently per tenant', async () => {
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    const body = input();
    expect((await post(body)).status).toBe(403);
    expect(
      await tdb.admin`select id from calls where provider_call_id = ${body.payload.providerCallId}`
    ).toHaveLength(0);
    const forB = {
      ...body,
      payload: {
        ...body.payload,
        contactId: b.contactId,
        agentId: 'agent_synthetic_b',
        recordingKey: `${IDS.tenantB}/calls/synthetic-b/recording`
      }
    };
    expect((await post(forB, tokenB)).status).toBe(201);
    await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
  });
  it('refuses missing, wrong-scope and revoked tokens before creating a call', async () => {
    const limited = await issueServiceToken(
      ctx.ownerA(),
      { label: 'wrong scope', scopes: ['contacts:read'] },
      { db }
    );
    const revoked = await issueServiceToken(
      ctx.ownerA(),
      { label: 'revoked', scopes: ['calls:write'] },
      { db }
    );
    await revokeServiceToken(ctx.ownerA(), revoked.id, { db });
    for (const token of ['', limited.token, revoked.token])
      expect((await post(input(), token)).status).toBe(401);
  });
  it('updates an existing started call and records DNC using the existing safety handler', async () => {
    const body = input();
    body.payload.outcome = 'dnc';
    const [pending] =
      await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at)
      values (${IDS.tenantA}, ${a.contactId}, 'elevenlabs', ${body.payload.providerCallId}, 'outbound', ${body.payload.startedAt}) returning id`;
    const response = await post(body);
    expect(response.status).toBe(201);
    expect((await response.json()).data.callId).toBe(pending!.id);
    const [contact] =
      await tdb.admin`select do_not_call_at from contacts where id = ${a.contactId}`;
    expect(contact!.do_not_call_at).not.toBeNull();
  });
  it('atomically rolls back call/activity/event creation when receipt persistence fails', async () => {
    const body = input();
    await tdb.admin
      .unsafe(`CREATE FUNCTION reject_relay_receipt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$;
      CREATE TRIGGER reject_relay_receipt BEFORE INSERT ON call_result_receipts FOR EACH ROW EXECUTE FUNCTION reject_relay_receipt();`);
    try {
      expect((await post(body)).status).toBe(500);
    } finally {
      await tdb.admin.unsafe(
        'DROP TRIGGER reject_relay_receipt ON call_result_receipts; DROP FUNCTION reject_relay_receipt();'
      );
    }
    expect(
      await tdb.admin`select id from calls where provider_call_id = ${body.payload.providerCallId}`
    ).toHaveLength(0);
    expect((await post(body)).status).toBe(201);
  });
  it('preserves native completion ownership and serializes native duplicate timeline/event writes', async () => {
    const body = input();
    const processor = createVoiceProcessor({
      provider: new FakeVoiceProvider(),
      db: createDb(tdb.worker)
    });
    const event = {
      id: crypto.randomUUID(),
      source: 'elevenlabs',
      externalId: body.eventId,
      tenantId: null,
      payload: {
        ...body.payload,
        kind: 'call.ended',
        externalId: body.eventId,
        counterpartE164: '+15555550101'
      }
    };
    await Promise.all([processor(event), processor(event)]);
    expect((await post(body)).status).toBe(409);
    const [call] =
      await tdb.admin`select id from calls where provider_call_id = ${body.payload.providerCallId}`;
    expect(
      await tdb.admin`select id from activities where ref_table = 'calls' and ref_id = ${call!.id}`
    ).toHaveLength(1);
  });
  it('enforces receipt tenant RLS, composite ownership and immutable runtime grants', async () => {
    const rows = await withTenant(ctx.ownerA(), (tx) => tx.select().from(callResultReceipts), {
      db
    });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenantId === IDS.tenantA)).toBe(true);
    expect(await db.select().from(callResultReceipts)).toHaveLength(0);
    const [foreign] = await tdb.admin`select id from calls where tenant_id = ${IDS.tenantB} limit 1`;
    for (const tenantId of [IDS.tenantA, IDS.tenantB]) {
      await expect(withTenant(ctx.ownerA(), (tx) => tx.insert(callResultReceipts).values({
        tenantId, eventId: crypto.randomUUID(), callId: foreign!.id,
        provider: 'elevenlabs', providerCallId: crypto.randomUUID(), payloadHash: '0'.repeat(64)
      }), { db })).rejects.toThrow();
    }
    for (const role of ['kynetic_app', 'kynetic_worker']) {
      const [grants] =
        await tdb.admin`select has_table_privilege(${role}, 'call_result_receipts', 'UPDATE') as updates,
        has_table_privilege(${role}, 'call_result_receipts', 'DELETE') as deletes`;
      expect(grants).toEqual({ updates: false, deletes: false });
    }
  });
});
