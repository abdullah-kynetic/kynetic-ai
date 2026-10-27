export type VoiceProviderId = 'elevenlabs' | 'retell';

export type StartOutboundCallInput = {
  tenantId: string;
  contactId: string;
  toE164: string;
  agentId: string;
  context: Record<string, unknown>;
  idempotencyKey: string;
};

export type VerifiedVoiceEvent = {
  externalId: string;
  providerCallId: string;
  /** The provider's id for the agent that took the call. Tenant resolution maps it (SECURITY 3.6 item 6). */
  agentId?: string;
  /** The lead's number in E.164 when the provider reports one; used to link calls we did not start. */
  counterpartE164?: string;
  kind: 'call.started' | 'call.ended' | 'inbound';
  direction: 'inbound' | 'outbound';
  startedAt: Date;
  durationS: number;
  outcome: string;
  sentiment?: string;
  recordingUrl?: string;
  transcript?: string;
  summary?: string;
  extracted?: Record<string, unknown>;
  costCents?: number;
};

export type WebhookHeaders = Record<string, string | undefined>;

export interface VoiceProvider {
  readonly id: VoiceProviderId;
  startOutboundCall(i: StartOutboundCallInput): Promise<{ providerCallId: string }>;
  /** Verifies the signature; throws ProviderError on failure. */
  parseWebhook(headers: WebhookHeaders, rawBody: string): VerifiedVoiceEvent;
  getRecordingUrl?(providerCallId: string): Promise<string>;
  /** Downloads the audio with the provider's own credentials, for providers whose URL needs them. */
  fetchRecording?(providerCallId: string): Promise<Uint8Array>;
  placeTestCall?(i: { agentId: string; toE164: string }): Promise<{ providerCallId: string }>;
}
