import { randomUUID } from 'node:crypto';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { ProviderError } from '../adapters/errors';
import { createStorage, tenantKey, type StorageAdapter } from '../adapters/storage';
import type { VerifiedVoiceEvent, VoiceProvider, VoiceProviderId } from '../adapters/voice/types';
import { recordActivity } from '../activity';
import { cleanDisclosure, disclosureHeard, disclosureVersion } from '../compliance';
import { addDncEntry } from '../consent';
import { createContact } from '../contacts/service';
import { getWorkerDb, type Db, type Tx } from '../db/client';
import { activities, calls, contacts, tenants } from '../db/schema';
import { getEnv } from '../env';
import { emitEvent } from '../events';
import { ModuleDisabledError, requireModule } from '../modules';
import { isModuleEnabled } from '../modules';
import { businessHoursSchema, isWithinBusinessHours } from '../settings/hours';
import { withTenant, type TenantContextInput } from '../tenancy';
import { registerWebhookProcessor, type WebhookProcessor } from '../webhooks';
import { normalizeOutcome, normalizeSentiment, outcomeLabel } from './outcomes';

// F-26, F-27, F-77, ARCHITECTURE section 3 "Inbound webhook". The route verified the signature and
// stored the event once; this processor runs in the worker. The tenant comes from our own agent
// mapping (SECURITY 3.6 item 6), never from the payload. Every step is safe to run again: the call
// row is keyed on (tenant, provider, provider call id), the timeline entry and `call.completed` are
// written once, and the recording is copied only while the row has none.

/** The stored webhook payload: the verified event with its date as an ISO string. */
export type VoiceEventPayload = Omit<VerifiedVoiceEvent, 'startedAt'> & {
  startedAt: string;
};

/** PRD decision 9 (recommended option): recordings and transcripts are cleared after 12 months. */
export const RETENTION_MONTHS = 12;
const MAX_TRANSCRIPT_CHARS = 200_000;
const MAX_SUMMARY_CHARS = 5_000;
const MAX_EXTRACTED_BYTES = 20_000;
const MAX_RECORDING_BYTES = 100 * 1024 * 1024;

export type VoiceProcessorDeps = {
  provider: VoiceProvider;
  storage?: StorageAdapter;
  db?: Db;
  fetch?: typeof fetch;
};

export function recordingKey(tenantId: string, callId: string): string {
  return tenantKey(tenantId, 'calls', callId, 'recording');
}

async function tenantForAgent(
  db: Db,
  provider: VoiceProviderId,
  agentId: string | undefined
): Promise<string | null> {
  if (!agentId) return null;
  const rows = await db.execute<{ tenant_id: string }>(
    sql`SELECT tenant_id FROM alex_agent_tenant_lookup(${provider}, ${agentId})`
  );
  return rows[0]?.tenant_id ?? null;
}

/** Keeps the jsonb small and flat-ish: untrusted provider content never grows a row without bound. */
function boundedExtracted(v: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!v) return {};
  return JSON.stringify(v).length <= MAX_EXTRACTED_BYTES ? v : { truncated: true };
}

function addMonths(d: Date, months: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + months);
  return out;
}

function durationText(s: number): string {
  const m = Math.floor(s / 60);
  return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
}

export function createVoiceProcessor(deps: VoiceProcessorDeps): WebhookProcessor {
  const db = () => deps.db ?? getWorkerDb();
  return async (row) => {
    const ev = row.payload as VoiceEventPayload;
    if (ev.kind === 'call.started') return; // the end event carries everything we store
    const tenantId = await tenantForAgent(db(), deps.provider.id, ev.agentId);
    if (!tenantId) {
      // An agent we do not map (deleted, or another environment's). Nothing to apply, and a retry
      // would not change that. Ids only in the log.
      console.warn(
        JSON.stringify({
          level: 'warn',
          msg: 'voice event for unmapped agent',
          webhookEventId: row.id
        })
      );
      return;
    }
    const ctx: TenantContextInput = { tenantId, role: 'system' };
    try {
      await requireModule(ctx, 'alex_core', { db: db() });
    } catch (e) {
      if (e instanceof ModuleDisabledError) return; // module off: call-ended processing is a no-op
      throw e;
    }
    const stored = await writeCall(ctx, ev, deps.provider.id, db());
    if (stored.needsRecording && ev.recordingUrl) {
      await copyRecording(ctx, ev, stored.callId, deps, db());
    }
  };
}

export function registerVoiceProcessor(deps: VoiceProcessorDeps): void {
  registerWebhookProcessor(deps.provider.id, createVoiceProcessor(deps));
}

// F-75: the call is only marked as disclosed once the words are in the transcript. A conversation
// with no sign of them is flagged for review (never unflagged here; a human clears a flag).
async function checkDisclosure(
  tx: Tx,
  ev: VoiceEventPayload,
  outcome: string,
  existing: { disclosureVersion: string | null; flagged: boolean } | undefined
): Promise<Partial<typeof calls.$inferInsert>> {
  const spoke = ev.durationS > 0 && !['no_answer', 'voicemail'].includes(outcome);
  if (!spoke || !ev.transcript?.trim()) return {};
  const [tenant] = await tx.select({ text: tenants.recordingDisclosure }).from(tenants).limit(1);
  const text = cleanDisclosure(tenant?.text);
  if (!text) return {};

  const current = disclosureVersion(text);
  // A different version at dial time means the text changed mid-call-cycle, so these words are not the ones sent.
  const sameText = !existing?.disclosureVersion || existing.disclosureVersion === current;
  if (sameText && disclosureHeard(ev.transcript, text)) {
    return { disclosureGiven: true, disclosureVersion: current };
  }
  if (existing?.flagged) return { disclosureGiven: false };
  return {
    disclosureGiven: false,
    flagged: true,
    flaggedAt: new Date().toISOString(),
    flagNote: sameText
      ? 'Recording disclosure not found in the transcript'
      : 'Recording disclosure changed since this call was placed; could not verify it was said'
  };
}

async function writeCall(
  ctx: TenantContextInput,
  ev: VoiceEventPayload,
  provider: VoiceProviderId,
  db: Db
): Promise<{ callId: string; needsRecording: boolean }> {
  return withTenant(ctx, (tx) => writeCallInTransaction(ctx, ev, provider, tx), { db });
}

/** Shared persistence for verified native events and the authenticated M13 relay. Never calls a provider. */
export async function writeCallInTransaction(
  ctx: TenantContextInput,
  ev: VoiceEventPayload,
  provider: VoiceProviderId,
  tx: Tx,
  resolvedContactId?: string
): Promise<{ callId: string; needsRecording: boolean }> {
  const outcome = normalizeOutcome(ev.outcome);
  const startedAt = new Date(ev.startedAt);
  const durationS = Math.max(0, Math.round(ev.durationS));
  const endedAt = new Date(startedAt.getTime() + durationS * 1000);
  // Serialize all native/relayed completions for this call before checking timeline/event idempotency.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtextextended(${`${ctx.tenantId}:${provider}:${ev.providerCallId}`}, 0))`
  );
  const [existing] = await tx
    .select({
      id: calls.id,
      contactId: calls.contactId,
      dealId: calls.dealId,
      recordingKey: calls.recordingKey,
      disclosureVersion: calls.disclosureVersion,
      flagged: calls.flagged
    })
    .from(calls)
    .where(
      and(
        eq(calls.tenantId, ctx.tenantId),
        eq(calls.provider, provider),
        eq(calls.providerCallId, ev.providerCallId)
      )
    )
    .limit(1);

  const disclosure = await checkDisclosure(tx, ev, outcome, existing);
  let contactId =
    existing?.contactId ?? resolvedContactId ?? (await contactForNumber(tx, ev.counterpartE164));
  if (!contactId && ev.direction === 'inbound' && ev.counterpartE164) {
    const [tenant] = await tx
      .select({ timezone: tenants.timezone, businessHours: tenants.businessHours })
      .from(tenants)
      .limit(1);
    const hours = businessHoursSchema.safeParse(tenant?.businessHours);
    const hasConfiguredHours =
      hours.success && Object.values(hours.data).some((windows) => (windows?.length ?? 0) > 0);
    const afterHours =
      hasConfiguredHours &&
      !isWithinBusinessHours(hours.data, tenant?.timezone ?? '', startedAt) &&
      (await isModuleEnabled(ctx, 'after_hours', { tx }));
    if (afterHours) {
      const contact = await createContact(
        ctx,
        {
          firstName: '',
          phones: [ev.counterpartE164],
          emails: [],
          source: 'after_hours',
          status: 'new',
          tags: ['after-hours'],
          address: {},
          custom: {}
        },
        { tx, acknowledgeDuplicates: true, asLead: true }
      );
      contactId = contact.id;
    }
  }
  const values = {
    direction: ev.direction,
    startedAt: startedAt.toISOString(),
    endedAt: endedAt.toISOString(),
    durationS,
    outcome,
    sentiment: normalizeSentiment(ev.sentiment),
    transcript: ev.transcript?.slice(0, MAX_TRANSCRIPT_CHARS) ?? null,
    summary: ev.summary?.slice(0, MAX_SUMMARY_CHARS) ?? null,
    extracted: boundedExtracted(ev.extracted),
    costCents: ev.costCents ?? null,
    purgeAfter: addMonths(endedAt, RETENTION_MONTHS).toISOString(),
    contactId,
    ...disclosure,
    updatedAt: new Date().toISOString()
  };

  let callId: string;
  if (existing) {
    callId = existing.id;
    await tx.update(calls).set(values).where(eq(calls.id, callId));
  } else {
    callId = randomUUID();
    // The unique key makes a concurrent delivery of the same call lose cleanly instead of duplicating.
    const inserted = await tx
      .insert(calls)
      .values({
        id: callId,
        tenantId: ctx.tenantId,
        provider,
        providerCallId: ev.providerCallId,
        ...values
      })
      .onConflictDoNothing()
      .returning({ id: calls.id });
    if (inserted.length === 0) {
      const [winner] = await tx
        .select({ id: calls.id })
        .from(calls)
        .where(
          and(
            eq(calls.tenantId, ctx.tenantId),
            eq(calls.provider, provider),
            eq(calls.providerCallId, ev.providerCallId)
          )
        )
        .limit(1);
      callId = winner!.id;
    }
  }

  const [seen] = await tx
    .select({ id: activities.id })
    .from(activities)
    .where(and(eq(activities.refTable, 'calls'), eq(activities.refId, callId)))
    .limit(1);
  if (!seen) {
    await recordActivity(tx, {
      contactId,
      dealId: existing?.dealId ?? null,
      type: 'call',
      refTable: 'calls',
      refId: callId,
      summary: `${ev.direction === 'inbound' ? 'Inbound call' : 'Alex call'}: ${outcomeLabel(outcome)} (${durationText(durationS)})`,
      actor: { type: 'alex' },
      occurredAt: startedAt
    });
    await emitEvent(tx, {
      name: 'call.completed',
      tenantId: ctx.tenantId,
      actor: { type: 'alex' },
      payload: {
        callId,
        contactId,
        outcome,
        direction: ev.direction,
        durationS,
        startedAt: startedAt.toISOString()
      }
    });
    if (outcome === 'dnc') await honourDnc(ctx, tx, contactId, ev.counterpartE164);
  }
  return { callId, needsRecording: !existing?.recordingKey };
}

/** Only an unambiguous match links a call we did not start; two contacts on one number link to none. */
async function contactForNumber(tx: Tx, e164: string | undefined): Promise<string | null> {
  if (!e164) return null;
  const rows = await tx
    .select({ id: contacts.id })
    .from(contacts)
    .where(
      and(
        eq(contacts.primaryPhoneE164, e164),
        isNull(contacts.deletedAt),
        isNull(contacts.mergedIntoId)
      )
    )
    .limit(2);
  return rows.length === 1 ? rows[0]!.id : null;
}

/** The lead asked on the call not to be called again: block the number and contact right away (SECURITY 3.3). */
async function honourDnc(
  ctx: TenantContextInput,
  tx: Tx,
  contactId: string | null,
  e164: string | undefined
): Promise<void> {
  if (!e164) return;
  await addDncEntry(ctx, { e164, contactId: contactId ?? undefined, source: 'opt_out' }, { tx });
}

function safeRecordingUrl(raw: string): URL | null {
  try {
    const u = new URL(raw);
    const host = u.hostname;
    if (
      u.protocol !== 'https:' ||
      host === 'localhost' ||
      /^[\d.]+$/.test(host) ||
      host.includes(':')
    )
      return null;
    return u;
  } catch {
    return null;
  }
}

async function download(
  ev: VoiceEventPayload,
  deps: VoiceProcessorDeps
): Promise<{ body: Uint8Array; contentType?: string } | null> {
  if (deps.provider.fetchRecording) {
    return {
      body: await deps.provider.fetchRecording(ev.providerCallId),
      contentType: 'audio/mpeg'
    };
  }
  const url = ev.recordingUrl ? safeRecordingUrl(ev.recordingUrl) : null;
  if (!url) return null;
  let res: Response;
  try {
    res = await (deps.fetch ?? fetch)(url, { redirect: 'error' });
  } catch {
    throw new ProviderError('transient', 'network', 'Could not download the recording');
  }
  if (!res.ok) {
    throw new ProviderError(
      res.status === 408 || res.status === 429 || res.status >= 500 ? 'transient' : 'permanent',
      `http_${res.status}`,
      `Recording download returned ${res.status}`
    );
  }
  return {
    body: new Uint8Array(await res.arrayBuffer()),
    contentType: res.headers.get('content-type') ?? undefined
  };
}

/**
 * Copies the audio into our own storage under the tenant prefix. A transient failure rethrows so the
 * job retries (the call row is already saved); a permanent one is logged and the call stays without
 * audio. The provider's URL is never stored: it would reach the audio without our signed URL.
 */
async function copyRecording(
  ctx: TenantContextInput,
  ev: VoiceEventPayload,
  callId: string,
  deps: VoiceProcessorDeps,
  db: Db
): Promise<void> {
  let audio: Awaited<ReturnType<typeof download>>;
  try {
    audio = await download(ev, deps);
  } catch (e) {
    if (e instanceof ProviderError && e.kind === 'permanent') {
      console.error(
        JSON.stringify({
          level: 'error',
          msg: 'recording unavailable',
          callId,
          code: e.code
        })
      );
      return;
    }
    throw e;
  }
  if (!audio || audio.body.byteLength === 0 || audio.body.byteLength > MAX_RECORDING_BYTES) return;
  const storage = deps.storage ?? createStorage(getEnv());
  const key = recordingKey(ctx.tenantId, callId);
  await storage.put(key, audio.body, {
    contentType: audio.contentType ?? 'audio/mpeg'
  });
  await withTenant(
    ctx,
    async (tx) => {
      await tx
        .update(calls)
        .set({ recordingKey: key, updatedAt: new Date().toISOString() })
        .where(eq(calls.id, callId));
    },
    { db }
  );
}
