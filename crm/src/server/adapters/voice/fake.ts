import { ProviderError } from '../errors';
import { verifyFakeSignature } from '../fake-signature';
import type {
  StartOutboundCallInput,
  VerifiedVoiceEvent,
  VoiceProvider,
  WebhookHeaders
} from './types';

export class FakeVoiceProvider implements VoiceProvider {
  readonly id = 'elevenlabs' as const;
  readonly calls: StartOutboundCallInput[] = [];
  private readonly byKey = new Map<string, string>();

  async startOutboundCall(i: StartOutboundCallInput) {
    if (!/^\+[1-9]\d{6,14}$/.test(i.toE164)) {
      throw new ProviderError('permanent', 'invalid_number', 'Destination is not E.164');
    }
    const existing = this.byKey.get(i.idempotencyKey);
    if (existing) return { providerCallId: existing };
    const providerCallId = `fake_call_${this.byKey.size + 1}`;
    this.byKey.set(i.idempotencyKey, providerCallId);
    this.calls.push(i);
    return { providerCallId };
  }

  parseWebhook(headers: WebhookHeaders, rawBody: string): VerifiedVoiceEvent {
    verifyFakeSignature(headers);
    const raw = JSON.parse(rawBody) as Omit<VerifiedVoiceEvent, 'startedAt'> & {
      startedAt: string;
    };
    return { ...raw, startedAt: new Date(raw.startedAt) };
  }

  async getRecordingUrl(providerCallId: string) {
    return `https://fake.invalid/recordings/${providerCallId}.mp3`;
  }

  async placeTestCall(i: { agentId: string; toE164: string }) {
    return this.startOutboundCall({
      tenantId: 'test',
      contactId: 'test',
      toE164: i.toE164,
      agentId: i.agentId,
      context: {},
      idempotencyKey: `test:${i.agentId}:${i.toE164}`
    });
  }
}
