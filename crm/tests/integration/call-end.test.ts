import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProviderError } from '@/server/adapters/errors';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { FakeVoiceProvider } from '@/server/adapters/voice/fake';
import type { VoiceProvider } from '@/server/adapters/voice/types';
import type { Actor } from '@/server/auth';
import {
  createVoiceProcessor,
  getCallRecordingUrl,
  handleVoiceWebhook,
  recordingKey
} from '@/server/calls';
import { AppError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import {
  clearWebhookProcessors,
  processWebhookEvent,
  registerWebhookProcessor
} from '@/server/webhooks';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';

let db: TestDatabase;
let a: SeededTenant;
let storage: FakeStorage;

const AGENT_A = 'agent_a';
const AGENT_B = 'agent_b';

beforeAll(async () => {
  db = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(db.admin));
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = db.urls.app;
  process.env.DATABASE_URL_WORKER = db.urls.worker;
  process.env.DATABASE_URL_AUTH = db.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  await db.admin`update alex_configs set provider = 'elevenlabs', agent_ref = ${AGENT_A} where tenant_id = ${IDS.tenantA}`;
  await db.admin`update alex_configs set provider = 'elevenlabs', agent_ref = ${AGENT_B} where tenant_id = ${IDS.tenantB}`;
});
afterAll(async () => {
  await stopJobs();
  await db?.drop();
});

let seq = 0;
function event(over: Record<string, unknown> = {}) {
  seq += 1;
  const id = `conv_${seq}`;
  return {
    externalId: id,
    providerCallId: id,
    agentId: AGENT_A,
    counterpartE164: '+15555550101',
    kind: 'call.ended',
    direction: 'outbound',
    startedAt: '2026-10-26T10:00:00.000Z',
    durationS: 84,
    outcome: 'booked',
    sentiment: 'positive',
    recordingUrl: 'https://fake.invalid/recordings/x.mp3',
    transcript: 'Alex: Hi\nLead: Yes',
    summary: 'Lead agreed to an estimate.',
    extracted: { service: 'roof repair' },
    ...over
  };
}

class RecordingFake extends FakeVoiceProvider {
  failTransient = 0;
  async fetchRecording(): Promise<Uint8Array> {
    if (this.failTransient > 0) {
      this.failTransient -= 1;
      throw new ProviderError('transient', 'http_503', 'down');
    }
    return new Uint8Array([1, 2, 3]);
  }
}

function setup() {
  const provider = new RecordingFake();
  storage = new FakeStorage();
  clearWebhookProcessors();
  registerWebhookProcessor('elevenlabs', createVoiceProcessor({ provider, storage }));
  return provider;
}

function post(provider: VoiceProvider, body: unknown, valid = true) {
  return handleVoiceWebhook(
    new Request('http://localhost:3000/api/hooks/voice/elevenlabs', {
      method: 'POST',
      headers: { 'x-fake-signature': valid ? 'valid' : 'nope' },
      body: JSON.stringify(body)
    }),
    { provider }
  );
}

async function run(externalId: string) {
  const [row] =
    await db.admin`select id from webhook_events where source = 'elevenlabs' and external_id = ${externalId}`;
  return processWebhookEvent(row.id);
}

const callsFor = (providerCallId: string) =>
  db.admin`select * from calls where provider = 'elevenlabs' and provider_call_id = ${providerCallId}`;

const staffActor = (tenantId: string, role: 'owner' | 'staff'): Actor => ({
  userId: role === 'owner' ? IDS.ownerA : IDS.staffA,
  kyneticRole: null,
  membership: { tenantId, role, canExport: false, canBulkDelete: false },
  viewAs: null
});

beforeEach(async () => {
  await db.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
});

describe('M4-05 call-end processing', () => {
  it('writes the call, a timeline entry and the recording, and emits call.completed', async () => {
    const provider = setup();
    const ev = event();
    expect((await post(provider, ev)).status).toBe(200);
    await run(ev.externalId);

    const [call] = await callsFor(ev.providerCallId);
    expect(call).toMatchObject({
      tenant_id: IDS.tenantA,
      outcome: 'booked',
      sentiment: 'positive',
      direction: 'outbound',
      duration_s: 84,
      summary: 'Lead agreed to an estimate.',
      contact_id: a.contactId
    });
    expect(call.extracted).toEqual({ service: 'roof repair' });
    expect(call.recording_key).toBe(recordingKey(IDS.tenantA, call.id));
    expect(call.recording_key.startsWith(`${IDS.tenantA}/`)).toBe(true);
    expect(call.recording_provider_url).toBeNull();
    expect(new Date(call.purge_after).getUTCFullYear()).toBe(2027);
    expect((await storage.get(call.recording_key))?.body).toEqual(new Uint8Array([1, 2, 3]));

    const acts =
      await db.admin`select * from activities where ref_table = 'calls' and ref_id = ${call.id}`;
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ type: 'call', actor_type: 'alex', contact_id: a.contactId });
    expect(acts[0].summary).toContain('booked');
    const jobs =
      await db.admin`select count(*)::int as n from pgboss.job where name = 'event.dispatch' and data->>'name' = 'call.completed' and data->'payload'->>'callId' = ${call.id}`;
    expect(jobs[0].n).toBe(1);
  });

  it('the same event replayed 10 times has one effect', async () => {
    const provider = setup();
    const ev = event();
    for (let i = 0; i < 10; i++) expect((await post(provider, ev)).status).toBe(200);
    const stored =
      await db.admin`select id from webhook_events where source = 'elevenlabs' and external_id = ${ev.externalId}`;
    expect(stored).toHaveLength(1);
    await run(ev.externalId);
    // Even the job redelivered, or the processor run directly again, changes nothing.
    expect(await run(ev.externalId)).toBe('already_processed');
    const processor = createVoiceProcessor({ provider, storage });
    await processor({
      id: stored[0].id,
      source: 'elevenlabs',
      externalId: ev.externalId,
      tenantId: null,
      payload: ev
    });
    const [call] = await callsFor(ev.providerCallId);
    expect(await callsFor(ev.providerCallId)).toHaveLength(1);
    const acts = await db.admin`select 1 from activities where ref_id = ${call.id}`;
    expect(acts).toHaveLength(1);
    const jobs =
      await db.admin`select count(*)::int as n from pgboss.job where name = 'event.dispatch' and data->'payload'->>'callId' = ${call.id}`;
    expect(jobs[0].n).toBe(1);
  });

  it('the same external id from another source is its own event', async () => {
    const provider = setup();
    const ev = event();
    await post(provider, ev);
    const other = new FakeVoiceProvider();
    Object.defineProperty(other, 'id', { value: 'retell' });
    await post(other, ev);
    const rows =
      await db.admin`select source from webhook_events where external_id = ${ev.externalId} order by source`;
    expect(rows.map((r) => r.source)).toEqual(['elevenlabs', 'retell']);
  });

  it('a bad signature stores nothing and answers 401', async () => {
    const provider = setup();
    const ev = event();
    expect((await post(provider, ev, false)).status).toBe(401);
    const rows = await db.admin`select 1 from webhook_events where external_id = ${ev.externalId}`;
    expect(rows).toHaveLength(0);
  });

  it('updates the call row an outbound start already wrote and keeps its contact and deal', async () => {
    const provider = setup();
    const ev = event({ counterpartE164: undefined });
    await db.admin`insert into calls (tenant_id, contact_id, deal_id, provider, provider_call_id, direction, started_at, disclosure_given)
      values (${IDS.tenantA}, ${a.contactId}, ${a.dealId}, 'elevenlabs', ${ev.providerCallId}, 'outbound', now(), true)`;
    await post(provider, ev);
    await run(ev.externalId);
    const rows = await callsFor(ev.providerCallId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      contact_id: a.contactId,
      deal_id: a.dealId,
      outcome: 'booked',
      disclosure_given: true
    });
    const [act] = await db.admin`select deal_id from activities where ref_id = ${rows[0].id}`;
    expect(act.deal_id).toBe(a.dealId);
  });

  it('resolves the tenant from the agent mapping, not from the payload', async () => {
    const provider = setup();
    const ev = event({
      agentId: AGENT_B,
      counterpartE164: undefined,
      extracted: { tenantId: IDS.tenantA, tenant_id: IDS.tenantA }
    });
    await post(provider, ev);
    await run(ev.externalId);
    const [call] = await callsFor(ev.providerCallId);
    expect(call.tenant_id).toBe(IDS.tenantB);
  });

  it('an unmapped agent writes nothing and does not retry', async () => {
    const provider = setup();
    const ev = event({ agentId: 'agent_unknown' });
    await post(provider, ev);
    expect(await run(ev.externalId)).toBe('processed');
    expect(await callsFor(ev.providerCallId)).toHaveLength(0);
  });

  it('with alex_core off the event is a no-op', async () => {
    const provider = setup();
    await db.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    const ev = event();
    await post(provider, ev);
    await run(ev.externalId);
    expect(await callsFor(ev.providerCallId)).toHaveLength(0);
  });

  it('maps unknown outcomes to other and failed starts to no_answer', async () => {
    const provider = setup();
    const odd = event({ outcome: 'Something New', sentiment: 'ecstatic', recordingUrl: undefined });
    const failed = event({ outcome: 'failed:busy', durationS: 0, recordingUrl: undefined });
    await post(provider, odd);
    await post(provider, failed);
    await run(odd.externalId);
    await run(failed.externalId);
    expect((await callsFor(odd.providerCallId))[0]).toMatchObject({
      outcome: 'other',
      sentiment: 'unknown',
      recording_key: null
    });
    expect((await callsFor(failed.providerCallId))[0].outcome).toBe('no_answer');
  });

  it('a transient recording failure retries without a second call row or timeline entry', async () => {
    const provider = setup();
    provider.failTransient = 1;
    const ev = event();
    await post(provider, ev);
    await expect(run(ev.externalId)).rejects.toThrow();
    let [call] = await callsFor(ev.providerCallId);
    expect(call.recording_key).toBeNull();
    await run(ev.externalId);
    [call] = await callsFor(ev.providerCallId);
    expect(call.recording_key).not.toBeNull();
    expect(await callsFor(ev.providerCallId)).toHaveLength(1);
    expect(await db.admin`select 1 from activities where ref_id = ${call.id}`).toHaveLength(1);
  });

  it('a call that ends in DNC blocks the number and the contact', async () => {
    const provider = setup();
    const ev = event({ outcome: 'dnc', recordingUrl: undefined });
    await post(provider, ev);
    await run(ev.externalId);
    const dnc =
      await db.admin`select contact_id from dnc_entries where tenant_id = ${IDS.tenantA} and e164 = '+15555550101' and removed_at is null`;
    expect(dnc).toHaveLength(1);
    const [c] = await db.admin`select do_not_call_at from contacts where id = ${a.contactId}`;
    expect(c.do_not_call_at).not.toBeNull();
  });

  it('links an inbound call to the one contact with that number', async () => {
    const provider = setup();
    const ev = event({ kind: 'inbound', direction: 'inbound', agentId: AGENT_A });
    await post(provider, ev);
    await run(ev.externalId);
    const [call] = await callsFor(ev.providerCallId);
    expect(call).toMatchObject({ direction: 'inbound', contact_id: a.contactId });
  });
});

describe('M4-05 recording access', () => {
  async function processed() {
    const provider = setup();
    const ev = event();
    await post(provider, ev);
    await run(ev.externalId);
    return (await callsFor(ev.providerCallId))[0];
  }

  it('the owner gets a short-lived signed URL; the key is not exposed', async () => {
    const call = await processed();
    const { url } = await getCallRecordingUrl(
      staffActor(IDS.tenantA, 'owner'),
      ctx.ownerA(),
      call.id,
      storage
    );
    expect(storage.fetchSigned(url)?.body).toEqual(new Uint8Array([1, 2, 3]));
    expect(url).toContain('expires=');
  });

  it('another tenant gets a 404 and a user with no membership is forbidden', async () => {
    const call = await processed();
    await expect(
      getCallRecordingUrl(staffActor(IDS.tenantB, 'owner'), ctx.ownerB(), call.id, storage)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      getCallRecordingUrl(
        { userId: IDS.ownerB, kyneticRole: null, membership: null, viewAs: null },
        ctx.ownerA(),
        call.id,
        storage
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('a call with no recording is a 404, and a key outside the tenant is never signed', async () => {
    const provider = setup();
    const ev = event({ recordingUrl: undefined });
    await post(provider, ev);
    await run(ev.externalId);
    const [call] = await callsFor(ev.providerCallId);
    const actor = staffActor(IDS.tenantA, 'owner');
    await expect(getCallRecordingUrl(actor, ctx.ownerA(), call.id, storage)).rejects.toBeInstanceOf(
      AppError
    );
    await db.admin`update calls set recording_key = ${`${IDS.tenantB}/calls/x/recording`} where id = ${call.id}`;
    await expect(getCallRecordingUrl(actor, ctx.ownerA(), call.id, storage)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
});
