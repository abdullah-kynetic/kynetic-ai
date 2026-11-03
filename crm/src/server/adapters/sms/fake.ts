import { ProviderError } from '../errors';
import { verifyFakeSignature } from '../fake-signature';
import type { WebhookHeaders } from '../voice/types';
import { isHelpKeyword, isStopKeyword } from './keywords';
import type {
  A2pStatus,
  SendSmsInput,
  SmsProvider,
  VerifiedInboundSms,
  VerifiedSmsStatus
} from './types';

export class FakeSmsProvider implements SmsProvider {
  readonly id = 'twilio' as const;
  readonly sent: SendSmsInput[] = [];
  a2p: A2pStatus = 'none';
  private readonly byKey = new Map<string, string>();

  async send(i: SendSmsInput) {
    if (!/^\+[1-9]\d{6,14}$/.test(i.toE164)) {
      throw new ProviderError('permanent', 'invalid_number', 'Destination is not E.164');
    }
    const existing = this.byKey.get(i.idempotencyKey);
    if (existing) return { providerId: existing };
    const providerId = `fake_sms_${this.byKey.size + 1}`;
    this.byKey.set(i.idempotencyKey, providerId);
    this.sent.push(i);
    return { providerId };
  }

  parseStatusCallback(headers: WebhookHeaders, rawBody: string): VerifiedSmsStatus {
    verifyFakeSignature(headers);
    return JSON.parse(rawBody) as VerifiedSmsStatus;
  }

  parseInbound(headers: WebhookHeaders, rawBody: string): VerifiedInboundSms {
    verifyFakeSignature(headers);
    const raw = JSON.parse(rawBody) as Omit<VerifiedInboundSms, 'isStop' | 'isHelp'>;
    return {
      ...raw,
      isStop: isStopKeyword(raw.body),
      isHelp: isHelpKeyword(raw.body)
    };
  }

  async getA2pStatus() {
    return this.a2p;
  }
}
