import { createHmac, timingSafeEqual } from 'node:crypto';
import { ProviderError } from '../errors';
import type {
  StartOutboundCallInput,
  VerifiedVoiceEvent,
  VoiceProvider,
  WebhookHeaders
} from './types';

// ARCHITECTURE 7 and "Provider integration details": Retell is the fallback behind the same
// VoiceProvider interface, so the platform is configuration (`alex_configs.provider`). Signature
// rules: SECURITY 3.6.

const DEFAULT_BASE_URL = 'https://api.retellai.com';
const SIGNATURE_HEADER = 'x-retell-signature';
/** SECURITY 3.6 item 2: five-minute window on the signed timestamp. */
const TOLERANCE_MS = 300_000;
const IDEMPOTENCY_CACHE_MAX = 1000;

export type RetellOptions = {
  /** Also the webhook signing key: Retell signs with the API key that has the webhook badge. */
  apiKey: string;
  /** E.164 number calls go out from. */
  fromNumber?: string;
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

export class RetellVoiceProvider implements VoiceProvider {
  readonly id = 'retell' as const;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => Date;
  // Retell has no idempotency header. This only covers a retry inside one process; the durable
  // guard is the unique idempotency key on the `calls` row that M4-06 writes before dialing.
  private readonly started = new Map<string, string>();

  constructor(private readonly opts: RetellOptions) {
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
    if (!this.opts.fromNumber) {
      throw new ProviderError('config', 'no_phone_number', 'Retell from-number is not set');
    }

    // Retell dynamic variables must be strings.
    const variables = Object.fromEntries(
      Object.entries(i.context).map(([k, v]) => [k, typeof v === 'string' ? v : JSON.stringify(v)])
    );
    const res = await this.request('/v2/create-phone-call', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        from_number: this.opts.fromNumber,
        to_number: i.toE164,
        override_agent_id: i.agentId,
        retell_llm_dynamic_variables: variables,
        // Cross-check only. Resolution still uses our own agent mapping (SECURITY 3.6 item 6).
        metadata: { tenant_id: i.tenantId, contact_id: i.contactId }
      })
    });
    const json: unknown = await res.json().catch(() => null);
    const callId = isDict(json) ? str(json.call_id) : undefined;
    if (!callId) {
      throw new ProviderError('permanent', 'call_not_started', 'Retell did not start the call');
    }

    if (this.started.size >= IDEMPOTENCY_CACHE_MAX) {
      this.started.delete(this.started.keys().next().value as string);
    }
    this.started.set(i.idempotencyKey, callId);
    return { providerCallId: callId };
  }

  parseWebhook(headers: WebhookHeaders, rawBody: string): VerifiedVoiceEvent {
    this.verifySignature(headers, rawBody);
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      throw new ProviderError('permanent', 'bad_payload', 'Webhook body is not JSON');
    }
    if (!isDict(parsed) || !isDict(parsed.call)) {
      throw new ProviderError('permanent', 'bad_payload', 'Webhook body has no call');
    }
    const event = str(parsed.event) ?? 'unknown';
    const call = parsed.call;
    const callId = str(call.call_id);
    if (!callId) {
      throw new ProviderError('permanent', 'bad_payload', 'Webhook has no call id');
    }
    // call_started and call_analyzed repeat the same call. call_ended carries everything we store.
    if (event !== 'call_ended') {
      throw new ProviderError('permanent', 'unsupported_event', `Unhandled Retell event ${event}`);
    }

    const analysis = isDict(call.call_analysis) ? call.call_analysis : {};
    const extracted = isDict(analysis.custom_analysis_data)
      ? Object.fromEntries(
          Object.entries(analysis.custom_analysis_data).filter(
            ([, v]) => v !== undefined && v !== null
          )
        )
      : {};
    const direction = call.direction === 'inbound' ? 'inbound' : 'outbound';
    const durationMs = num(call.duration_ms) ?? 0;
    const connected = durationMs > 0;
    const reason = str(call.disconnection_reason) ?? 'unknown';
    const cost = isDict(call.call_cost) ? num(call.call_cost.combined_cost) : undefined;

    return {
      externalId: callId,
      providerCallId: callId,
      kind: direction === 'inbound' ? 'inbound' : 'call.ended',
      direction,
      startedAt: new Date(num(call.start_timestamp) ?? this.now().getTime()),
      durationS: Math.round(durationMs / 1000),
      outcome: connected
        ? (str(extracted.outcome) ?? this.successOutcome(analysis))
        : `failed:${reason}`,
      sentiment: str(analysis.user_sentiment)?.toLowerCase(),
      recordingUrl: str(call.recording_url),
      transcript: this.transcript(call.transcript_object),
      summary: str(analysis.call_summary),
      extracted,
      // Retell reports combined_cost in US cents.
      costCents: cost === undefined ? undefined : Math.round(cost)
    };
  }

  /** Retell recording URLs are pre-signed, so M4-05 can fetch them without a key. */
  async getRecordingUrl(providerCallId: string): Promise<string> {
    const res = await this.request(`/v2/get-call/${encodeURIComponent(providerCallId)}`, {
      method: 'GET'
    });
    const json: unknown = await res.json().catch(() => null);
    const url = isDict(json) ? str(json.recording_url) : undefined;
    if (!url) throw new ProviderError('permanent', 'no_recording', 'Retell has no recording');
    return url;
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

  private successOutcome(analysis: Dict): string {
    if (analysis.call_successful === true) return 'success';
    if (analysis.call_successful === false) return 'unsuccessful';
    return 'unknown';
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...init.headers,
          authorization: `Bearer ${this.opts.apiKey}`
        }
      });
    } catch {
      throw new ProviderError('transient', 'network', 'Could not reach Retell');
    }
    if (!res.ok) {
      // Status only. The response body can echo request data, so it is never put in the message.
      throw new ProviderError(
        kindForStatus(res.status),
        `http_${res.status}`,
        `Retell returned ${res.status}`
      );
    }
    return res;
  }

  /** Header is `v=<unix ms>,d=<hex HMAC-SHA256 of body + timestamp>`, keyed with the API key. */
  private verifySignature(headers: WebhookHeaders, rawBody: string): void {
    const value = header(headers, SIGNATURE_HEADER);
    if (!value) throw badSignature();
    const parts = new Map(value.split(',').map((p) => p.trim().split('=') as [string, string]));
    const v = parts.get('v');
    const d = parts.get('d');
    if (!v || !d || !/^\d+$/.test(v)) throw badSignature();
    if (Math.abs(this.now().getTime() - Number(v)) > TOLERANCE_MS) throw badSignature();

    const expected = createHmac('sha256', this.opts.apiKey).update(`${rawBody}${v}`).digest();
    const given = Buffer.from(d, 'hex');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) throw badSignature();
  }

  private transcript(turns: unknown): string | undefined {
    if (!Array.isArray(turns)) return undefined;
    const lines = turns.flatMap((t) => {
      if (!isDict(t)) return [];
      const content = str(t.content);
      return content ? [`${t.role === 'user' ? 'Lead' : 'Alex'}: ${content}`] : [];
    });
    return lines.length ? lines.join('\n') : undefined;
  }
}
