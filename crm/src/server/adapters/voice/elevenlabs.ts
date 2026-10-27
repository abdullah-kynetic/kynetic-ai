import { createHmac, timingSafeEqual } from 'node:crypto';
import { ProviderError } from '../errors';
import type {
  StartOutboundCallInput,
  VerifiedVoiceEvent,
  VoiceProvider,
  WebhookHeaders
} from './types';

// ARCHITECTURE 7 and "Provider integration details" (F-77, F-78). Signature rules: SECURITY 3.6.

const DEFAULT_BASE_URL = 'https://api.elevenlabs.io';
const SIGNATURE_HEADER = 'elevenlabs-signature';
/** SECURITY 3.6 item 2: five-minute window on the signed timestamp. */
const TOLERANCE_S = 300;
const IDEMPOTENCY_CACHE_MAX = 1000;

export type ElevenLabsOptions = {
  apiKey: string;
  webhookSecret: string;
  /** ElevenLabs id of the phone number calls go out from. Needs the paid plan and a phone import. */
  agentPhoneNumberId?: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Injected so tests control the signature window. */
  now?: () => Date;
};

type Dict = Record<string, unknown>;

const isDict = (v: unknown): v is Dict => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | undefined => (typeof v === 'string' && v ? v : undefined);
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const e164 = (v: unknown): string | undefined =>
  typeof v === 'string' && /^\+[1-9]\d{6,14}$/.test(v) ? v : undefined;

function kindForStatus(status: number): 'transient' | 'permanent' | 'config' {
  if (status === 401 || status === 403) return 'config';
  if (status === 408 || status === 429 || status >= 500) return 'transient';
  return 'permanent';
}

function header(headers: WebhookHeaders, name: string): string | undefined {
  for (const [k, v] of Object.entries(headers)) if (k.toLowerCase() === name) return v;
  return undefined;
}

function badSignature(): ProviderError {
  return new ProviderError('permanent', 'bad_signature', 'Webhook signature verification failed');
}

function unsupported(type: string): ProviderError {
  return new ProviderError('permanent', 'unsupported_event', `Unhandled ElevenLabs event ${type}`);
}

export class ElevenLabsVoiceProvider implements VoiceProvider {
  readonly id = 'elevenlabs' as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  // ElevenLabs has no idempotency header. This only covers a retry inside one process; the durable
  // guard is the unique idempotency key on the `calls` row that M4-06 writes before dialing.
  private readonly started = new Map<string, string>();

  constructor(private readonly opts: ElevenLabsOptions) {
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
    this.fetchImpl = opts.fetch ?? fetch;
    this.now = opts.now ?? (() => new Date());
  }

  async startOutboundCall(i: StartOutboundCallInput): Promise<{ providerCallId: string }> {
    if (!/^\+[1-9]\d{6,14}$/.test(i.toE164)) {
      throw new ProviderError('permanent', 'invalid_number', 'Destination is not E.164');
    }
    const existing = this.started.get(i.idempotencyKey);
    if (existing) return { providerCallId: existing };
    if (!this.opts.agentPhoneNumberId) {
      throw new ProviderError('config', 'no_phone_number', 'ElevenLabs phone number id is not set');
    }

    const body = {
      agent_id: i.agentId,
      agent_phone_number_id: this.opts.agentPhoneNumberId,
      to_number: i.toE164,
      conversation_initiation_client_data: {
        dynamic_variables: i.context,
        // Tenant and contact ride along so a late webhook can be cross-checked. Resolution still
        // uses our own agent mapping, never these (SECURITY 3.6 item 6).
        user_id: `${i.tenantId}:${i.contactId}`
      }
    };
    const res = await this.request('/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const json: unknown = await res.json().catch(() => null);
    const conversationId = isDict(json) ? str(json.conversation_id) : undefined;
    if (!isDict(json) || json.success === false || !conversationId) {
      throw new ProviderError('permanent', 'call_not_started', 'ElevenLabs did not start the call');
    }

    if (this.started.size >= IDEMPOTENCY_CACHE_MAX) {
      this.started.delete(this.started.keys().next().value as string);
    }
    this.started.set(i.idempotencyKey, conversationId);
    return { providerCallId: conversationId };
  }

  parseWebhook(headers: WebhookHeaders, rawBody: string): VerifiedVoiceEvent {
    this.verifySignature(headers, rawBody);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new ProviderError('permanent', 'bad_payload', 'Webhook body is not JSON');
    }
    if (!isDict(parsed) || !isDict(parsed.data)) {
      throw new ProviderError('permanent', 'bad_payload', 'Webhook body has no data');
    }
    const type = str(parsed.type) ?? 'unknown';
    const data = parsed.data;
    const conversationId = str(data.conversation_id);
    if (!conversationId) {
      throw new ProviderError('permanent', 'bad_payload', 'Webhook has no conversation id');
    }

    if (type === 'call_initiation_failure') {
      const at = num(parsed.event_timestamp);
      return {
        externalId: `${conversationId}:call_initiation_failure`,
        providerCallId: conversationId,
        agentId: str(data.agent_id),
        kind: 'call.ended',
        direction: 'outbound',
        startedAt: new Date((at ?? this.now().getTime() / 1000) * 1000),
        durationS: 0,
        outcome: `failed:${str(data.failure_reason) ?? 'unknown'}`
      };
    }
    if (type !== 'post_call_transcription') throw unsupported(type);

    const metadata = isDict(data.metadata) ? data.metadata : {};
    const phoneCall = isDict(metadata.phone_call) ? metadata.phone_call : {};
    const analysis = isDict(data.analysis) ? data.analysis : {};
    const extracted = this.extract(analysis.data_collection_results);
    const direction = phoneCall.direction === 'inbound' ? 'inbound' : 'outbound';
    const startSecs = num(metadata.start_time_unix_secs) ?? num(parsed.event_timestamp) ?? 0;

    return {
      externalId: conversationId,
      providerCallId: conversationId,
      agentId: str(data.agent_id),
      counterpartE164: e164(phoneCall.external_number),
      kind: direction === 'inbound' ? 'inbound' : 'call.ended',
      direction,
      startedAt: new Date(startSecs * 1000),
      durationS: num(metadata.call_duration_secs) ?? 0,
      outcome:
        str(extracted.outcome) ?? str(analysis.call_successful) ?? str(data.status) ?? 'unknown',
      recordingUrl: data.has_audio === true ? this.audioUrl(conversationId) : undefined,
      transcript: this.transcript(data.transcript),
      summary: str(analysis.transcript_summary),
      extracted
    };
  }

  /** The audio endpoint needs the `xi-api-key` header, so M4-05 fetches it with `fetchRecording`. */
  async getRecordingUrl(providerCallId: string): Promise<string> {
    return this.audioUrl(providerCallId);
  }

  async fetchRecording(providerCallId: string): Promise<Uint8Array> {
    const res = await this.request(
      `/v1/convai/conversations/${encodeURIComponent(providerCallId)}/audio`,
      {
        method: 'GET'
      }
    );
    return new Uint8Array(await res.arrayBuffer());
  }

  placeTestCall(i: { agentId: string; toE164: string }) {
    return this.startOutboundCall({
      tenantId: 'test',
      contactId: 'test',
      toE164: i.toE164,
      agentId: i.agentId,
      context: {},
      idempotencyKey: `test:${i.agentId}:${i.toE164}:${this.now().getTime()}`
    });
  }

  private audioUrl(id: string): string {
    return `${this.baseUrl}/v1/convai/conversations/${encodeURIComponent(id)}/audio`;
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: { ...init.headers, 'xi-api-key': this.opts.apiKey }
      });
    } catch {
      throw new ProviderError('transient', 'network', 'Could not reach ElevenLabs');
    }
    if (!res.ok) {
      // Status only. The response body can echo request data, so it is never put in the message.
      throw new ProviderError(
        kindForStatus(res.status),
        `http_${res.status}`,
        `ElevenLabs returned ${res.status}`
      );
    }
    return res;
  }

  private verifySignature(headers: WebhookHeaders, rawBody: string): void {
    const value = header(headers, SIGNATURE_HEADER);
    if (!value) throw badSignature();
    const parts = new Map(value.split(',').map((p) => p.trim().split('=') as [string, string]));
    const t = parts.get('t');
    const v0 = parts.get('v0');
    if (!t || !v0 || !/^\d+$/.test(t)) throw badSignature();
    if (Math.abs(this.now().getTime() / 1000 - Number(t)) > TOLERANCE_S) throw badSignature();

    const expected = createHmac('sha256', this.opts.webhookSecret)
      .update(`${t}.${rawBody}`)
      .digest();
    const given = Buffer.from(v0, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw badSignature();
  }

  private transcript(turns: unknown): string | undefined {
    if (!Array.isArray(turns)) return undefined;
    const lines = turns.flatMap((t) => {
      if (!isDict(t)) return [];
      const message = str(t.message);
      return message ? [`${t.role === 'user' ? 'Lead' : 'Alex'}: ${message}`] : [];
    });
    return lines.length ? lines.join('\n') : undefined;
  }

  /** Keeps only the collected value of each data point. Content is untrusted text (SECURITY 3.6). */
  private extract(results: unknown): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    if (!isDict(results)) return out;
    for (const [k, v] of Object.entries(results)) {
      if (isDict(v) && v.value !== undefined && v.value !== null) out[k] = v.value;
    }
    return out;
  }
}
