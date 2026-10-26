import { ProviderError } from '../errors';
import { verifyFakeSignature } from '../fake-signature';
import type { WebhookHeaders } from '../voice/types';
import type { EmailProvider, SendEmailInput, VerifiedEmailEvent } from './types';

export class FakeEmailProvider implements EmailProvider {
  readonly id = 'resend' as const;
  readonly sent: SendEmailInput[] = [];
  private readonly byKey = new Map<string, string>();

  async send(i: SendEmailInput) {
    if (!i.to.includes('@')) {
      throw new ProviderError('permanent', 'invalid_address', 'Recipient is not an email address');
    }
    const existing = this.byKey.get(i.idempotencyKey);
    if (existing) return { providerId: existing };
    const providerId = `fake_email_${this.byKey.size + 1}`;
    this.byKey.set(i.idempotencyKey, providerId);
    this.sent.push(i);
    return { providerId };
  }

  parseWebhook(headers: WebhookHeaders, rawBody: string): VerifiedEmailEvent {
    verifyFakeSignature(headers);
    return JSON.parse(rawBody) as VerifiedEmailEvent;
  }
}
