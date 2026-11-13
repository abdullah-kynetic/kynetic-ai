import { randomUUID } from 'node:crypto';
import { and, count, eq, gte, isNull, sql } from 'drizzle-orm';
import { ProviderError } from '../adapters/errors';
import type { VoiceProvider } from '../adapters/voice/types';
import { recordActivity } from '../activity';
import {
  cleanDisclosure,
  contactState,
  disclosureVersion,
  isTwoPartyState,
  STATE_RULES
} from '../compliance';
import { checkWindow, isValidTimeZone } from '../consent/quiet-hours';
import { getWorkerDb, type Db, type Tx } from '../db/client';
import { alexConfigs, calls, contacts, tenants } from '../db/schema';
import { getEnv } from '../env';
import { subscribe } from '../events';
import { enqueue, registerWorker } from '../jobs';
import { ModuleDisabledError, requireModule } from '../modules';
import { checkOutbound, type OutboundGateOpts } from '../outbound';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseCallWindow, parseRetryDelays } from './outbound-config';
import { getVoiceProvider, isVoiceProviderId } from './provider';

// F-78, SECURITY 3.4, ARCHITECTURE section 3 "Outbound action". A `lead.created` event queues
// attempt 1; each attempt is one job. An attempt that runs outside the call window, under the kill
// switch or in quiet hours waits and keeps its number; a started attempt schedules the next one from
// `alex_configs.retry`. Dialing is at most once per attempt: the call row is written before the
// provider is called, and a count of outbound calls since the lead arrived tells a redelivered job
// that its attempt already happened.

export const OUTBOUND_CALL_QUEUE = 'call.outbound';
export const OUTBOUND_SUBSCRIBER_ID = 'alex-outbound-call';
export const OUTBOUND_TRIGGER = 'lead.created';

/** F-101: when the kill switch is on, queued calls wait and resume within a minute of it going off. */
export const KILL_SWITCH_RECHECK_MS = 60_000;
/** A lead older than this is no longer a speed-to-lead call; a human follows up (SECURITY 3.4). */
export const MAX_LEAD_AGE_MS = 24 * 3_600_000;
/** A previous attempt with no end report is treated as lost after this long. */
const CALL_IN_PROGRESS_MS = 30 * 60_000;
const IN_PROGRESS_RECHECK_MS = 2 * 60_000;
/**
 * A row still holding the pending marker this long after it was written means the worker died
 * between dialing and saving the provider call id. Longer than any one attempt takes, shorter than
 * pg-boss's redelivery of an expired job.
 */
const PENDING_STALE_MS = 10 * 60_000;
/** Outcomes where nobody was reached, so the next scheduled attempt still makes sense. */
const UNREACHED = ['no_answer', 'voicemail', 'other'];

export type OutboundCallJob = {
  tenantId: string;
  contactId: string;
  dealId: string | null;
  trigger: string;
  /** 1 is the first call; each retry adds one. */
  attempt: number;
  /** When the lead arrived (the event's `occurredAt`); anchors expiry and the duplicate check. */
  leadAt: string;
};

export type OutboundCallResult =
  | { status: 'started'; callId: string }
  | { status: 'deferred'; until: Date; reason: string }
  | { status: 'stopped'; reason: string }
  | { status: 'duplicate' };

export type OutboundCallDeps = {
  db?: Db;
  now?: () => Date;
  provider?: (id: string) => VoiceProvider | null;
  queue?: typeof enqueue;
  /** Per-state windows from the counsel-reviewed config (M4-07). */
  gate?: Pick<OutboundGateOpts, 'outboundEnabled' | 'stateWindows' | 'tenantHourlyCallCap'>;
};

export const outboundIdempotencyKey = (
  j: Pick<OutboundCallJob, 'tenantId' | 'contactId' | 'trigger' | 'attempt'>
) => `${j.tenantId}:${j.contactId}:${j.trigger}:${j.attempt}`;

const pendingId = (key: string) => `pending:${key}`;

function resolveProvider(id: string, deps: OutboundCallDeps): VoiceProvider | null {
  if (deps.provider) return deps.provider(id);
  return isVoiceProviderId(id) ? getVoiceProvider(id) : null;
}

/** Runs one attempt. Exported so tests drive it with a fake clock and fake provider. */
export async function runOutboundCall(
  job: OutboundCallJob,
  deps: OutboundCallDeps = {}
): Promise<OutboundCallResult> {
  const now = (deps.now ?? (() => new Date()))();
  const db = deps.db ?? getWorkerDb();
  const queue = deps.queue ?? enqueue;
  const ctx: TenantContextInput = { tenantId: job.tenantId, role: 'system' };
  const key = outboundIdempotencyKey(job);
  const stop = (reason: string): OutboundCallResult => ({
    status: 'stopped',
    reason
  });
  const defer = async (until: Date, reason: string): Promise<OutboundCallResult> => {
    await queue(OUTBOUND_CALL_QUEUE, job, {
      startAfter: until,
      singletonKey: key
    });
    return { status: 'deferred', until, reason };
  };

  try {
    await requireModule(ctx, 'alex_core', { db });
  } catch (e) {
    if (e instanceof ModuleDisabledError) return stop('module_off'); // no retry, no side effect
    throw e;
  }
  const leadAt = new Date(job.leadAt);
  if (now.getTime() - leadAt.getTime() > MAX_LEAD_AGE_MS) return stop('expired');

  const snap = await withTenant(
    ctx,
    async (tx) => {
      const [alex] = await tx.select().from(alexConfigs).limit(1);
      const [tenant] = await tx
        .select({
          timezone: tenants.timezone,
          recordingDisclosure: tenants.recordingDisclosure
        })
        .from(tenants)
        .where(eq(tenants.id, job.tenantId))
        .limit(1);
      const [contact] = await tx
        .select()
        .from(contacts)
        .where(
          and(
            eq(contacts.id, job.contactId),
            isNull(contacts.deletedAt),
            isNull(contacts.mergedIntoId)
          )
        )
        .limit(1);
      const prior = await tx
        .select({
          id: calls.id,
          outcome: calls.outcome,
          startedAt: calls.startedAt,
          providerCallId: calls.providerCallId
        })
        .from(calls)
        .where(
          and(
            eq(calls.contactId, job.contactId),
            eq(calls.direction, 'outbound'),
            gte(calls.startedAt, leadAt.toISOString())
          )
        );
      return { alex, tenant, contact, prior };
    },
    { db }
  );
  const { alex, tenant, contact, prior } = snap;

  const delays = parseRetryDelays(alex?.retry);
  const next = job.attempt <= delays.length ? delays[job.attempt - 1] : undefined;
  const scheduleNext = (tx: Tx) =>
    next === undefined
      ? Promise.resolve(null)
      : queue(
          OUTBOUND_CALL_QUEUE,
          { ...job, attempt: job.attempt + 1 },
          {
            tx,
            startAfter: new Date(now.getTime() + next * 60_000),
            singletonKey: outboundIdempotencyKey({
              ...job,
              attempt: job.attempt + 1
            })
          }
        );

  // A row still holding this attempt's pending marker means a worker died after writing it: before
  // dialing, or after dialing and before saving the provider call id. Which one is unknowable, so the
  // attempt counts as spent (never dial it again) and the cadence moves on instead of stalling.
  const lost = prior.find((c) => c.providerCallId === pendingId(key));
  if (lost) {
    if (now.getTime() - new Date(lost.startedAt).getTime() < PENDING_STALE_MS) {
      return { status: 'duplicate' }; // the first worker is probably still running
    }
    const recovered = await withTenant(
      ctx,
      async (tx) => {
        const rows = await tx
          .update(calls)
          .set({
            outcome: 'other',
            endedAt: now.toISOString(),
            durationS: 0,
            extracted: { startError: 'lost:provider_call_id_not_saved' },
            updatedAt: now.toISOString()
          })
          .where(
            and(
              eq(calls.id, lost.id),
              eq(calls.providerCallId, pendingId(key)),
              isNull(calls.outcome)
            )
          )
          .returning({ id: calls.id });
        if (rows.length === 0) return false; // another worker recovered it first
        await recordActivity(tx, {
          contactId: job.contactId,
          dealId: job.dealId,
          type: 'system',
          summary: 'Alex call status unknown: it may have been placed but was never confirmed',
          actor: { type: 'system' },
          meta: {
            check: 'outbound_call',
            reason: 'lost_attempt',
            callId: lost.id,
            attempt: job.attempt
          }
        });
        await scheduleNext(tx);
        return true;
      },
      { db }
    );
    return recovered ? stop('attempt_unconfirmed') : { status: 'duplicate' };
  }
  if (prior.length >= job.attempt) return { status: 'duplicate' };
  if (!contact || !contact.primaryPhoneE164) return stop('no_phone');
  const provider = alex?.agentRef ? resolveProvider(alex.provider, deps) : null;
  if (!alex || !alex.agentRef || !provider) {
    await note(ctx, db, job, 'Alex call not started: no voice agent is configured', 'no_agent');
    return stop('no_agent');
  }

  // F-75: no call goes out without the tenant's disclosure text, since Alex must say it first.
  const disclosure = cleanDisclosure(tenant?.recordingDisclosure);
  if (!disclosure) {
    await note(
      ctx,
      db,
      job,
      'Alex call not started: no recording disclosure is set for this business',
      'no_disclosure'
    );
    return stop('no_disclosure');
  }

  if (prior.some((c) => c.outcome && !UNREACHED.includes(c.outcome))) return stop('reached');
  const running = prior.some(
    (c) => !c.outcome && now.getTime() - new Date(c.startedAt).getTime() < CALL_IN_PROGRESS_MS
  );
  if (running) {
    return defer(new Date(now.getTime() + IN_PROGRESS_RECHECK_MS), 'previous_call_in_progress');
  }

  // Alex's own window, kept inside the compliance window. The gate below still decides quiet hours
  // and state rules; this check only avoids a blocked-activity row for every deferral.
  const tz = [contact.timezone, tenant?.timezone].find(isValidTimeZone);
  if (tz) {
    const open = checkWindow(now, tz, parseCallWindow(alex.callWindows));
    if (!open.open) return defer(open.nextOpen, 'outside_call_window');
  }

  const killSwitchOff = deps.gate?.outboundEnabled ?? getEnv().OUTBOUND_ENABLED;
  if (!killSwitchOff) {
    return defer(new Date(now.getTime() + KILL_SWITCH_RECHECK_MS), 'outbound_disabled');
  }
  const decision = await checkOutbound(
    ctx,
    {
      contactId: contact.id,
      channel: 'phone_call',
      module: 'alex_core',
      purpose: 'speed_to_lead'
    },
    now,
    { db, outboundEnabled: killSwitchOff, ...deps.gate }
  );
  if (!decision.allowed) {
    // Quiet hours are the one deferrable answer; the rest end the sequence, and the gate already
    // wrote the "blocked: reason" activity.
    if (decision.reason === 'quiet_hours' && decision.retryAt) {
      return defer(decision.retryAt, 'quiet_hours');
    }
    if (decision.reason === 'global_pause') {
      return defer(new Date(now.getTime() + KILL_SWITCH_RECHECK_MS), 'global_pause');
    }
    return stop(decision.reason);
  }

  // Write the row first: the unique key on (tenant, provider, provider call id) makes two workers
  // racing on one attempt lose cleanly (advisory lock plus recount), and a crash after the dial leaves a
  // pending row rather than a second call; a later run of the same attempt closes that row and moves
  // the cadence on (see PENDING_STALE_MS).
  const callId = randomUUID();
  // F-75: a contact in a two-party-consent state has the call marked for review from the start.
  const state = contactState(contact.address);
  const twoParty = isTwoPartyState(state);
  const inserted = await withTenant(
    ctx,
    async (tx) => {
      // The lock serializes workers on one attempt; the recount inside it sees a row the other worker
      // already committed (its provider call id is no longer the pending marker by then).
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
      const [seen] = await tx
        .select({ n: count() })
        .from(calls)
        .where(
          and(
            eq(calls.contactId, contact.id),
            eq(calls.direction, 'outbound'),
            gte(calls.startedAt, leadAt.toISOString())
          )
        );
      if ((seen?.n ?? 0) >= job.attempt) return [];
      return tx
        .insert(calls)
        .values({
          id: callId,
          tenantId: job.tenantId,
          contactId: contact.id,
          dealId: job.dealId,
          provider: provider.id,
          providerCallId: pendingId(key),
          direction: 'outbound',
          startedAt: now.toISOString(),
          // `disclosure_given` stays false until call-end processing finds the words in the transcript.
          disclosureVersion: disclosureVersion(disclosure),
          ...(twoParty
            ? {
                flagged: true,
                flaggedAt: now.toISOString(),
                flagNote: `Two-party recording state ${state} (state rules ${STATE_RULES.version}, not yet reviewed by counsel)`
              }
            : {})
        })
        .onConflictDoNothing()
        .returning({ id: calls.id });
    },
    { db }
  );
  if (inserted.length === 0) return { status: 'duplicate' };

  try {
    const { providerCallId } = await provider.startOutboundCall({
      tenantId: job.tenantId,
      contactId: contact.id,
      toE164: contact.primaryPhoneE164,
      agentId: alex.agentRef,
      context: {
        lead_first_name: contact.firstName,
        call_reason: 'new_lead',
        // The agent prompt must open with this line before anything is recorded (SECURITY 3.5).
        recording_disclosure: disclosure,
        attempt: job.attempt
      },
      idempotencyKey: key
    });
    await withTenant(
      ctx,
      async (tx) => {
        await tx
          .update(calls)
          .set({ providerCallId, updatedAt: now.toISOString() })
          .where(eq(calls.id, callId));
        await scheduleNext(tx);
      },
      { db }
    );
    return { status: 'started', callId };
  } catch (e) {
    if (!(e instanceof ProviderError)) throw e;
    // The attempt is spent either way (the provider may have placed the call before failing), so
    // the row stays as a failed call. A transient failure still leaves the next attempt scheduled; a
    // permanent or config one (bad number, no phone-number id) ends the sequence.
    await withTenant(
      ctx,
      async (tx) => {
        await tx
          .update(calls)
          .set({
            outcome: 'other',
            endedAt: now.toISOString(),
            durationS: 0,
            extracted: { startError: `${e.kind}:${e.code}` },
            updatedAt: now.toISOString()
          })
          .where(eq(calls.id, callId));
        await recordActivity(tx, {
          contactId: contact.id,
          dealId: job.dealId,
          type: 'system',
          // No refTable/refId: call-end processing treats a calls-linked activity as its own timeline entry.
          summary: 'Alex call could not start',
          actor: { type: 'system' },
          meta: {
            check: 'outbound_call',
            callId,
            attempt: job.attempt,
            error: `${e.kind}:${e.code}`
          }
        });
        if (e.kind === 'transient') await scheduleNext(tx);
      },
      { db }
    );
    return stop(`provider_${e.kind}`);
  }
}

async function note(
  ctx: TenantContextInput,
  db: Db,
  job: OutboundCallJob,
  summary: string,
  reason: string
): Promise<void> {
  await withTenant(
    ctx,
    (tx) =>
      recordActivity(tx, {
        contactId: job.contactId,
        dealId: job.dealId,
        type: 'system',
        summary,
        actor: { type: 'system' },
        meta: { check: 'outbound_call', reason }
      }),
    { db }
  );
}

/** Queues attempt 1 for a new lead. Redelivery of the event queues nothing extra (same singleton key). */
export function registerOutboundCallSubscriber(deps: { queue?: typeof enqueue } = {}): void {
  const queue = deps.queue ?? enqueue;
  subscribe(
    'lead.created',
    OUTBOUND_SUBSCRIBER_ID,
    async (env) => {
      const contactId = env.payload.contactId;
      if (typeof contactId !== 'string') return;
      const dealId = typeof env.payload.dealId === 'string' ? env.payload.dealId : null;
      const job: OutboundCallJob = {
        tenantId: env.tenantId,
        contactId,
        dealId,
        trigger: OUTBOUND_TRIGGER,
        attempt: 1,
        leadAt: env.occurredAt
      };
      await queue(OUTBOUND_CALL_QUEUE, job, {
        singletonKey: outboundIdempotencyKey(job)
      });
    },
    { module: 'alex_core' }
  );
}

export async function registerOutboundCallWorker(deps: OutboundCallDeps = {}): Promise<void> {
  await registerWorker<OutboundCallJob>(OUTBOUND_CALL_QUEUE, async (job) => {
    await runOutboundCall(job, deps);
  });
}
