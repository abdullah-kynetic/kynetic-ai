import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { ProviderError } from '@/server/adapters/errors';
import { FakeVoiceProvider } from '@/server/adapters/voice/fake';
import type { StartOutboundCallInput } from '@/server/adapters/voice/types';
import {
  KILL_SWITCH_RECHECK_MS,
  MAX_LEAD_AGE_MS,
  OUTBOUND_CALL_QUEUE,
  outboundIdempotencyKey,
  registerOutboundCallSubscriber,
  runOutboundCall,
  type OutboundCallDeps,
  type OutboundCallJob
} from '@/server/calls';
import { disclosureVersion } from '@/server/compliance';
import { recordConsent } from '@/server/consent';
import { createDb, type Db } from '@/server/db/client';
import { contacts } from '@/server/db/schema';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { stopJobs } from '@/server/jobs';
import { withTenant } from '@/server/tenancy';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;

// Tenant A is America/Los_Angeles (PDT, UTC-7 on this date).
const DISCLOSURE = 'This call may be recorded for quality and training purposes.';
const MIDDAY = new Date('2026-10-26T18:00:00Z'); // 11:00 local
const minutes = (d: Date, n: number) => new Date(d.getTime() + n * 60_000);

type Queued = { payload: OutboundCallJob; startAfter?: Date; singletonKey?: string };

function fakeQueue() {
  const items: Queued[] = [];
  const fn = (async (
    queue: string,
    payload: object,
    opts: { startAfter?: Date; singletonKey?: string } = {}
  ) => {
    expect(queue).toBe(OUTBOUND_CALL_QUEUE);
    items.push({
      payload: payload as OutboundCallJob,
      startAfter: opts.startAfter,
      singletonKey: opts.singletonKey
    });
    return 'job-id';
  }) as unknown as NonNullable<OutboundCallDeps['queue']>;
  return { items, fn };
}

class RecordingProvider extends FakeVoiceProvider {
  fail: ProviderError | null = null;
  // The unique key is per tenant and provider, so each harness needs its own call ids.
  readonly tag = crypto.randomUUID().slice(0, 8);
  async startOutboundCall(i: StartOutboundCallInput) {
    if (this.fail) throw this.fail;
    const r = await super.startOutboundCall(i);
    return { providerCallId: `${this.tag}_${r.providerCallId}` };
  }
}

let seq = 0;
async function newLead(opts: { consent?: boolean; state?: string } = {}) {
  seq += 1;
  const [c] = await withTenant(
    ctx.ownerA(),
    (tx) =>
      tx
        .insert(contacts)
        .values({
          tenantId: IDS.tenantA,
          firstName: `Lead ${seq}`,
          primaryPhoneE164: `+1555555${String(4000 + seq)}`,
          ...(opts.state ? { address: { state: opts.state } } : {})
        })
        .returning(),
    { db }
  );
  if (opts.consent !== false) {
    await recordConsent(
      ctx.ownerA(),
      {
        contactId: c!.id,
        channel: 'phone_call',
        source: 'form',
        capturedText: 'ok to call',
        capturedAt: new Date('2026-10-01T00:00:00Z')
      },
      { db }
    );
  }
  return c!;
}

const job = (contactId: string, over: Partial<OutboundCallJob> = {}): OutboundCallJob => ({
  tenantId: IDS.tenantA,
  contactId,
  dealId: a.dealId,
  trigger: 'lead.created',
  attempt: 1,
  leadAt: MIDDAY.toISOString(),
  ...over
});

function harness(over: Omit<Partial<OutboundCallDeps>, 'now'> & { now?: Date } = {}) {
  const provider = new RecordingProvider();
  const queue = fakeQueue();
  const { now: startNow, ...rest } = over;
  const state = { now: startNow ?? MIDDAY, killSwitchOn: true };
  const deps = (): OutboundCallDeps => ({
    db,
    now: () => state.now,
    provider: () => provider,
    queue: queue.fn,
    gate: { outboundEnabled: state.killSwitchOn },
    ...rest
  });
  return {
    provider,
    queue,
    state,
    run: (j: OutboundCallJob) => runOutboundCall(j, deps())
  };
}

const callRows = (contactId: string) =>
  tdb.admin`select * from calls where contact_id = ${contactId} order by started_at, created_at`;
const activityRows = (contactId: string) =>
  tdb.admin`select summary from activities where contact_id = ${contactId} order by created_at`;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.worker);
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});
beforeEach(async () => {
  await tdb.admin`update tenants set recording_disclosure = ${DISCLOSURE} where id = ${IDS.tenantA}`;
  await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
  await tdb.admin`update alex_configs set provider = 'elevenlabs', agent_ref = 'agent_a', paused = false,
    call_windows = '{}'::jsonb, retry = '{}'::jsonb where tenant_id = ${IDS.tenantA}`;
});

describe('M4-06 outbound call start (F-78)', () => {
  it('starts a call for a consented lead inside the window and queues the next attempt', async () => {
    const lead = await newLead();
    const h = harness();
    const res = await h.run(job(lead.id));
    expect(res.status).toBe('started');

    expect(h.provider.calls).toHaveLength(1);
    expect(h.provider.calls[0]).toMatchObject({
      tenantId: IDS.tenantA,
      contactId: lead.id,
      toE164: lead.primaryPhoneE164,
      agentId: 'agent_a',
      idempotencyKey: `${IDS.tenantA}:${lead.id}:lead.created:1`
    });
    const rows = await callRows(lead.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      direction: 'outbound',
      provider: 'elevenlabs',
      provider_call_id: `${h.provider.tag}_fake_call_1`,
      deal_id: a.dealId
    });
    expect(h.queue.items).toHaveLength(1);
    expect(h.queue.items[0]).toMatchObject({
      payload: { attempt: 2, contactId: lead.id },
      startAfter: minutes(MIDDAY, 5),
      singletonKey: `${IDS.tenantA}:${lead.id}:lead.created:2`
    });
  });

  it('follows the retry cadence on a fake clock and stops after the last attempt', async () => {
    await tdb.admin`update alex_configs set retry = '{"delaysMinutes":[5,60]}'::jsonb where tenant_id = ${IDS.tenantA}`;
    const lead = await newLead();
    const h = harness();

    expect((await h.run(job(lead.id))).status).toBe('started');
    expect(h.queue.items.at(-1)).toMatchObject({
      payload: { attempt: 2 },
      startAfter: minutes(MIDDAY, 5)
    });
    await tdb.admin`update calls set outcome = 'no_answer' where contact_id = ${lead.id}`;

    h.state.now = minutes(MIDDAY, 5);
    expect((await h.run(job(lead.id, { attempt: 2 }))).status).toBe('started');
    expect(h.queue.items.at(-1)).toMatchObject({
      payload: { attempt: 3 },
      startAfter: minutes(MIDDAY, 65)
    });
    await tdb.admin`update calls set outcome = 'voicemail' where contact_id = ${lead.id} and outcome is null`;

    h.state.now = minutes(MIDDAY, 65);
    const before = h.queue.items.length;
    expect((await h.run(job(lead.id, { attempt: 3 }))).status).toBe('started');
    expect(h.queue.items).toHaveLength(before); // no attempt 4
    expect(h.provider.calls).toHaveLength(3);
    expect(await callRows(lead.id)).toHaveLength(3);
  });

  it('an empty retry list means one attempt', async () => {
    await tdb.admin`update alex_configs set retry = '{"delaysMinutes":[]}'::jsonb where tenant_id = ${IDS.tenantA}`;
    const lead = await newLead();
    const h = harness();
    expect((await h.run(job(lead.id))).status).toBe('started');
    expect(h.queue.items).toHaveLength(0);
  });

  it('stops retrying once the lead was reached', async () => {
    const lead = await newLead();
    const h = harness();
    await h.run(job(lead.id));
    await tdb.admin`update calls set outcome = 'booked' where contact_id = ${lead.id}`;
    h.state.now = minutes(MIDDAY, 5);
    expect(await h.run(job(lead.id, { attempt: 2 }))).toEqual({
      status: 'stopped',
      reason: 'reached'
    });
    expect(h.provider.calls).toHaveLength(1);
  });

  it('waits while the previous attempt has no end report yet', async () => {
    const lead = await newLead();
    const h = harness();
    await h.run(job(lead.id));
    h.state.now = minutes(MIDDAY, 5);
    const res = await h.run(job(lead.id, { attempt: 2 }));
    expect(res).toMatchObject({ status: 'deferred', reason: 'previous_call_in_progress' });
    expect(h.provider.calls).toHaveLength(1);
    // A call with no report after 30 minutes is treated as lost, so the retry goes ahead.
    h.state.now = minutes(MIDDAY, 31);
    expect((await h.run(job(lead.id, { attempt: 2 }))).status).toBe('started');
  });

  it('never dials outside the lead-local window: it waits for the next opening', async () => {
    const lead = await newLead();
    const h = harness({ now: new Date('2026-10-27T05:00:00Z') }); // 22:00 local
    const res = await h.run(job(lead.id, { leadAt: '2026-10-27T05:00:00Z' }));
    expect(res).toMatchObject({
      status: 'deferred',
      reason: 'outside_call_window',
      until: new Date('2026-10-27T15:00:00Z') // 08:00 PDT
    });
    expect(h.provider.calls).toHaveLength(0);
    expect(await callRows(lead.id)).toHaveLength(0);
    expect(h.queue.items[0]).toMatchObject({
      startAfter: new Date('2026-10-27T15:00:00Z'),
      singletonKey: outboundIdempotencyKey(job(lead.id))
    });
    expect(h.queue.items[0]!.payload.attempt).toBe(1);

    // The same job, when it runs after the opening, places the call.
    h.state.now = new Date('2026-10-27T15:00:00Z');
    expect((await h.run(job(lead.id, { leadAt: '2026-10-27T05:00:00Z' }))).status).toBe('started');
  });

  it("Alex's own call window narrows the compliance window and can never widen it", async () => {
    await tdb.admin`update alex_configs set call_windows = '{"start":"09:00","end":"17:00"}'::jsonb where tenant_id = ${IDS.tenantA}`;
    const early = await newLead();
    const h1 = harness({ now: new Date('2026-10-26T15:30:00Z') }); // 08:30 local: legal, but before 09:00
    expect(await h1.run(job(early.id, { leadAt: '2026-10-26T15:30:00Z' }))).toMatchObject({
      status: 'deferred',
      until: new Date('2026-10-26T16:00:00Z')
    });
    const late = await newLead();
    const h2 = harness({ now: new Date('2026-10-27T01:30:00Z') }); // 18:30 local: after 17:00
    expect(await h2.run(job(late.id, { leadAt: '2026-10-27T01:30:00Z' }))).toMatchObject({
      status: 'deferred',
      until: new Date('2026-10-27T16:00:00Z')
    });

    await tdb.admin`update alex_configs set call_windows = '{"start":"05:00","end":"23:59"}'::jsonb where tenant_id = ${IDS.tenantA}`;
    const wide = await newLead();
    const h3 = harness({ now: new Date('2026-10-27T05:00:00Z') }); // 22:00 local
    expect((await h3.run(job(wide.id, { leadAt: '2026-10-27T05:00:00Z' }))).status).toBe(
      'deferred'
    );
    expect(h3.provider.calls).toHaveLength(0);
  });

  it('defers on a quiet-hours answer from the gate (a state window) to its retryAt', async () => {
    const lead = await newLead({ state: 'CA' });
    const h = harness({
      now: new Date('2026-10-26T16:00:00Z'), // 09:00 local: inside 08:00 to 21:00
      gate: {
        outboundEnabled: true,
        stateWindows: { CA: { startMinute: 10 * 60, endMinute: 20 * 60 } }
      }
    });
    const res = await h.run(job(lead.id, { leadAt: '2026-10-26T16:00:00Z' }));
    expect(res).toMatchObject({
      status: 'deferred',
      reason: 'quiet_hours',
      until: new Date('2026-10-26T17:00:00Z')
    });
    expect(h.provider.calls).toHaveLength(0);
  });

  it('honors the kill switch: no call while it is on, and the call goes out within a minute of it going off', async () => {
    const lead = await newLead();
    const h = harness();
    h.state.killSwitchOn = false;
    const res = await h.run(job(lead.id));
    expect(res).toMatchObject({
      status: 'deferred',
      reason: 'outbound_disabled',
      until: new Date(MIDDAY.getTime() + KILL_SWITCH_RECHECK_MS)
    });
    expect(h.provider.calls).toHaveLength(0);
    expect(await callRows(lead.id)).toHaveLength(0);

    h.state.killSwitchOn = true;
    h.state.now = new Date(MIDDAY.getTime() + KILL_SWITCH_RECHECK_MS);
    expect((await h.run(job(lead.id))).status).toBe('started');
  });

  it('refuses a lead with no phone-call consent and logs why', async () => {
    const lead = await newLead({ consent: false });
    const h = harness();
    expect(await h.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'no_consent' });
    expect(h.provider.calls).toHaveLength(0);
    expect((await activityRows(lead.id)).map((r) => r.summary)).toContain(
      'blocked: no_consent (phone_call)'
    );
  });

  it('stops when Alex is paused, the module is off, the lead is stale, or there is no agent', async () => {
    const lead = await newLead();
    const h = harness();

    await tdb.admin`update alex_configs set paused = true where tenant_id = ${IDS.tenantA}`;
    expect(await h.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'alex_paused' });
    await tdb.admin`update alex_configs set paused = false where tenant_id = ${IDS.tenantA}`;

    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    expect(await h.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'module_off' });
    await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;

    const stale = harness({ now: new Date(MIDDAY.getTime() + MAX_LEAD_AGE_MS + 1000) });
    expect(await stale.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'expired' });

    await tdb.admin`update alex_configs set agent_ref = null where tenant_id = ${IDS.tenantA}`;
    expect(await h.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'no_agent' });
    expect(h.provider.calls).toHaveLength(0);
    expect(await callRows(lead.id)).toHaveLength(0);
  });

  it('a redelivered or concurrent attempt dials once', async () => {
    const lead = await newLead();
    const h = harness();
    const results = await Promise.all([h.run(job(lead.id)), h.run(job(lead.id))]);
    expect(results.filter((r) => r.status === 'started')).toHaveLength(1);
    expect(h.provider.calls).toHaveLength(1);

    expect(await h.run(job(lead.id))).toEqual({ status: 'duplicate' });
    expect(h.provider.calls).toHaveLength(1);
    expect(await callRows(lead.id)).toHaveLength(1);
  });

  it('a crash between dialing and saving the provider call id closes the attempt and moves on', async () => {
    const lead = await newLead();
    const h = harness();
    // The worker dies after the call row is written (the dial may or may not have happened).
    h.provider.startOutboundCall = async () => {
      throw new Error('worker killed');
    };
    await expect(h.run(job(lead.id))).rejects.toThrow('worker killed');
    const [pending] = await callRows(lead.id);
    expect(pending!.provider_call_id).toBe(`pending:${outboundIdempotencyKey(job(lead.id))}`);
    expect(h.queue.items).toHaveLength(0);

    // Redelivered while the first worker could still be running: left alone.
    h.state.now = minutes(MIDDAY, 1);
    expect(await h.run(job(lead.id))).toEqual({ status: 'duplicate' });
    expect((await callRows(lead.id))[0]!.outcome).toBeNull();

    // Redelivered after it must be dead: the attempt is spent, never dialed again, and attempt 2 is queued.
    h.state.now = minutes(MIDDAY, 16);
    expect(await h.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'attempt_unconfirmed' });
    const [closed] = await callRows(lead.id);
    expect(closed).toMatchObject({ outcome: 'other', duration_s: 0 });
    expect(closed!.extracted).toEqual({ startError: 'lost:provider_call_id_not_saved' });
    expect(h.queue.items).toHaveLength(1);
    expect(h.queue.items[0]).toMatchObject({
      payload: { attempt: 2 },
      startAfter: minutes(MIDDAY, 21)
    });
    expect((await activityRows(lead.id)).map((r) => r.summary)).toContain(
      'Alex call status unknown: it may have been placed but was never confirmed'
    );

    // A further redelivery changes nothing.
    expect(await h.run(job(lead.id))).toEqual({ status: 'duplicate' });
    expect(h.queue.items).toHaveLength(1);
    expect(await callRows(lead.id)).toHaveLength(1);
  });

  it('a transient provider failure spends the attempt and still schedules the next one', async () => {
    const lead = await newLead();
    const h = harness();
    h.provider.fail = new ProviderError('transient', 'http_503', 'down');
    expect(await h.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'provider_transient' });
    const [row] = await callRows(lead.id);
    expect(row).toMatchObject({ outcome: 'other', duration_s: 0 });
    expect(row!.extracted).toEqual({ startError: 'transient:http_503' });
    expect(h.queue.items.at(-1)).toMatchObject({
      payload: { attempt: 2 },
      startAfter: minutes(MIDDAY, 5)
    });
    expect((await activityRows(lead.id)).map((r) => r.summary)).toContain(
      'Alex call could not start'
    );
  });

  it('a permanent provider failure ends the sequence', async () => {
    const lead = await newLead();
    const h = harness();
    h.provider.fail = new ProviderError('permanent', 'invalid_number', 'bad number');
    expect(await h.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'provider_permanent' });
    expect(h.queue.items).toHaveLength(0);
  });

  it("cannot reach another tenant's contact", async () => {
    const h = harness();
    const [other] =
      await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantB} limit 1`;
    expect(await h.run(job(other!.id))).toEqual({ status: 'stopped', reason: 'no_phone' });
    expect(h.provider.calls).toHaveLength(0);
  });

  it('the per-contact daily cap (3) stops a long cadence', async () => {
    await tdb.admin`update alex_configs set retry = '{"delaysMinutes":[1,1,1]}'::jsonb where tenant_id = ${IDS.tenantA}`;
    const lead = await newLead();
    const h = harness();
    for (let n = 1; n <= 3; n += 1) {
      h.state.now = minutes(MIDDAY, n);
      expect((await h.run(job(lead.id, { attempt: n }))).status).toBe('started');
      await tdb.admin`update calls set outcome = 'no_answer' where contact_id = ${lead.id} and outcome is null`;
    }
    h.state.now = minutes(MIDDAY, 4);
    expect(await h.run(job(lead.id, { attempt: 4 }))).toEqual({
      status: 'stopped',
      reason: 'rate_cap'
    });
    expect(h.provider.calls).toHaveLength(3);
  });
});

describe('M4-06 lead.created subscriber', () => {
  const envelope = (payload: Record<string, unknown>): EventEnvelope => ({
    id: crypto.randomUUID(),
    name: 'lead.created',
    version: 1,
    tenantId: IDS.tenantA,
    occurredAt: MIDDAY.toISOString(),
    actor: { type: 'system' },
    payload
  });

  it('queues attempt 1 once per lead, anchored on the event time', async () => {
    clearSubscribers();
    const q = fakeQueue();
    registerOutboundCallSubscriber({ queue: q.fn });
    const env = envelope({ contactId: a.contactId, dealId: a.dealId, source: 'angi' });
    expect(await deliver(env, 'alex-outbound-call')).toBe('ran');
    expect(await deliver(env, 'alex-outbound-call')).toBe('ran'); // at-least-once redelivery
    expect(q.items).toHaveLength(2);
    expect(q.items[0]!.payload).toEqual({
      tenantId: IDS.tenantA,
      contactId: a.contactId,
      dealId: a.dealId,
      trigger: 'lead.created',
      attempt: 1,
      leadAt: MIDDAY.toISOString()
    });
    // Both carry the same singleton key, so the queue keeps one.
    expect(q.items[1]!.singletonKey).toBe(q.items[0]!.singletonKey);
  });

  it('does nothing when the alex_core module is off', async () => {
    clearSubscribers();
    const q = fakeQueue();
    registerOutboundCallSubscriber({ queue: q.fn });
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    expect(await deliver(envelope({ contactId: a.contactId }), 'alex-outbound-call')).toBe(
      'skipped'
    );
    expect(q.items).toHaveLength(0);
  });

  it('ignores an event with no contact', async () => {
    clearSubscribers();
    const q = fakeQueue();
    registerOutboundCallSubscriber({ queue: q.fn });
    await deliver(envelope({ source: 'angi' }), 'alex-outbound-call');
    expect(q.items).toHaveLength(0);
  });
});

describe('M4-07 compliance on the call path (F-74, F-75)', () => {
  it('stops and logs when the tenant has no recording disclosure', async () => {
    await tdb.admin`update tenants set recording_disclosure = '  ' where id = ${IDS.tenantA}`;
    const lead = await newLead();
    const h = harness();
    expect(await h.run(job(lead.id))).toEqual({ status: 'stopped', reason: 'no_disclosure' });
    expect(h.provider.calls).toHaveLength(0);
    expect(await callRows(lead.id)).toHaveLength(0);
    expect((await activityRows(lead.id)).map((r) => r.summary)).toContain(
      'Alex call not started: no recording disclosure is set for this business'
    );
  });

  it('sends the disclosure to the agent and records its version, not yet as heard', async () => {
    const lead = await newLead({ state: 'TX' });
    const h = harness();
    expect((await h.run(job(lead.id))).status).toBe('started');
    expect(h.provider.calls[0]?.context).toMatchObject({ recording_disclosure: DISCLOSURE });
    const [call] = await callRows(lead.id);
    expect(call).toMatchObject({
      disclosure_version: disclosureVersion(DISCLOSURE),
      disclosure_given: false,
      flagged: false
    });
  });

  it('marks the call for review for a contact in a two-party recording state', async () => {
    const lead = await newLead({ state: 'ca' });
    const h = harness();
    expect((await h.run(job(lead.id))).status).toBe('started');
    expect(h.provider.calls).toHaveLength(1); // still dialed: the disclosure plays on every call
    const [call] = await callRows(lead.id);
    expect(call.flagged).toBe(true);
    expect(call.flagged_by).toBeNull();
    expect(call.flag_note).toContain('CA');
    expect(call.flag_note).toContain('2026-10-26-draft');
  });

  it('applies the state table by default: Florida closes at 20:00 lead-local', async () => {
    const lead = await newLead({ state: 'FL' });
    const evening = new Date('2026-10-27T03:30:00Z'); // 20:30 in tenant A's zone
    const h = harness({ now: evening });
    const res = await h.run(job(lead.id, { leadAt: evening.toISOString() }));
    expect(res).toMatchObject({
      status: 'deferred',
      reason: 'quiet_hours',
      until: new Date('2026-10-27T15:00:00Z')
    });
    expect(h.provider.calls).toHaveLength(0);
    // The same hour is fine for a state with no extra rule.
    const tx = await newLead({ state: 'TX' });
    const h2 = harness({ now: evening });
    expect((await h2.run(job(tx.id, { leadAt: evening.toISOString() }))).status).toBe('started');
  });
});
