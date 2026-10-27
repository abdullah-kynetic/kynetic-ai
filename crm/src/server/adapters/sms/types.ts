import type { WebhookHeaders } from '../voice/types';

export type SendSmsInput = {
  tenantId: string;
  toE164: string;
  fromE164: string;
  body: string;
  idempotencyKey: string;
};

export type VerifiedSmsStatus = {
  providerId: string;
  /** `sent` covers every non-final carrier state (queued, accepted, sending, sent). */
  status: 'sent' | 'delivered' | 'failed' | 'undelivered';
  errorCode?: string;
  /** Our number (from) and the contact's (to) on an outbound message; the tenant is mapped from ours. */
  fromE164?: string;
  toE164?: string;
};

export type VerifiedInboundSms = {
  providerId: string;
  fromE164: string;
  toE164: string;
  body: string;
  isStop: boolean;
  isHelp: boolean;
};

export type A2pStatus = 'none' | 'pending' | 'approved' | 'rejected';

export interface SmsProvider {
  readonly id: 'twilio';
  send(i: SendSmsInput): Promise<{ providerId: string }>;
  parseStatusCallback(headers: WebhookHeaders, rawBody: string): VerifiedSmsStatus;
  parseInbound(headers: WebhookHeaders, rawBody: string): VerifiedInboundSms;
  getA2pStatus?(tenantId: string): Promise<A2pStatus>;
}
