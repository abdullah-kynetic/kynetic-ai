import type { WebhookHeaders } from '../voice/types';

export type SendEmailInput = {
  tenantId: string;
  to: string;
  fromName: string;
  fromAddress: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey: string;
};

export type VerifiedEmailEvent = {
  providerId: string;
  kind: 'delivered' | 'bounced' | 'complained';
  address: string;
};

export interface EmailProvider {
  readonly id: 'resend';
  send(i: SendEmailInput): Promise<{ providerId: string }>;
  parseWebhook(headers: WebhookHeaders, rawBody: string): VerifiedEmailEvent;
}
