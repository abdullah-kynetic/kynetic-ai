import { createHmac, timingSafeEqual } from 'node:crypto';
import { ProviderError } from '../errors';
import type { WebhookHeaders } from '../voice/types';
import { isHelpKeyword, isStopKeyword } from './keywords';
import type { SendSmsInput, SmsProvider, VerifiedInboundSms, VerifiedSmsStatus } from './types';

// ARCHITECTURE section 7 and 3 (Twilio row), SECURITY 3.6 and 3.7. Only the gate's SMS dispatch
// imports this file (SEC-T-13).

export const TWILIO_STATUS_PATH = '/api/hooks/twilio/status';
export const TWILIO_INBOUND_PATH = '/api/hooks/twilio/inbound';

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  /** Public origin Twilio calls, e.g. APP_BASE_URL. The signature covers the exact public URL. */
  publicBaseUrl: string;
  fetch?: typeof fetch;
};

/**
 * X-Twilio-Signature: base64 HMAC-SHA1 of the full URL followed by every POST parameter as
 * name+value, sorted by name, keyed with the account auth token.
 */
export function twilioSignature(authToken: string, url: string, params: URLSearchParams): string {
  const names = [...new Set(params.keys())].sort();
  let data = url;
  for (const name of names) for (const v of params.getAll(name).sort()) data += name + v;
  return createHmac('sha1', authToken).update(data).digest('base64');
}

function signatureMatches(expected: string, given: string | undefined): boolean {
  if (!given) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

function bad(): ProviderError {
  return new ProviderError('permanent', 'bad_signature', 'Webhook signature verification failed');
}

const NUMBER_ERRORS = new Set(['21211', '21214', '21217', '21614', '21408']);
const REGISTRATION_ERRORS = new Set(['30034', '30032', '30007']);

export class TwilioSmsProvider implements SmsProvider {
  readonly id = 'twilio' as const;
  private readonly doFetch: typeof fetch;

  constructor(private readonly cfg: TwilioConfig) {
    this.doFetch = cfg.fetch ?? fetch;
  }

  async send(i: SendSmsInput): Promise<{ providerId: string }> {
    if (!/^\+[1-9]\d{6,14}$/.test(i.toE164)) {
      throw new ProviderError('permanent', 'invalid_number', 'Destination is not E.164');
    }
    const form = new URLSearchParams({
      To: i.toE164,
      From: i.fromE164,
      Body: i.body,
      StatusCallback: new URL(TWILIO_STATUS_PATH, this.cfg.publicBaseUrl).toString()
    });
    let res: Response;
    try {
      res = await this.doFetch(
        `https://api.twilio.com/2010-04-01/Accounts/${this.cfg.accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            'I-Twilio-Idempotency-Token': i.idempotencyKey
          },
          body: form
        }
      );
    } catch {
      throw new ProviderError('transient', 'network', 'Twilio could not be reached');
    }
    const json = (await res.json().catch(() => ({}))) as {
      sid?: string;
      code?: number;
      message?: string;
    };
    if (res.ok && json.sid) return { providerId: json.sid };

    const code = String(json.code ?? res.status);
    if (res.status === 401 || res.status === 403) {
      throw new ProviderError('config', 'auth', 'Twilio rejected the credentials');
    }
    if (REGISTRATION_ERRORS.has(code)) {
      // A2P registration is missing or rejected; retrying cannot help (ARCHITECTURE section 3).
      throw new ProviderError('permanent', 'a2p_not_registered', `Twilio error ${code}`);
    }
    if (NUMBER_ERRORS.has(code))
      throw new ProviderError('permanent', 'invalid_number', `Twilio error ${code}`);
    if (res.status === 429 || res.status >= 500) {
      throw new ProviderError('transient', 'provider_unavailable', `Twilio error ${code}`);
    }
    throw new ProviderError('permanent', `twilio_${code}`, `Twilio error ${code}`);
  }

  private verified(headers: WebhookHeaders, rawBody: string, path: string): URLSearchParams {
    const params = new URLSearchParams(rawBody);
    const url = new URL(path, this.cfg.publicBaseUrl).toString();
    const expected = twilioSignature(this.cfg.authToken, url, params);
    if (!signatureMatches(expected, headers['x-twilio-signature'])) throw bad();
    return params;
  }

  parseStatusCallback(headers: WebhookHeaders, rawBody: string): VerifiedSmsStatus {
    const p = this.verified(headers, rawBody, TWILIO_STATUS_PATH);
    const providerId = p.get('MessageSid') ?? p.get('SmsSid');
    const raw = p.get('MessageStatus') ?? p.get('SmsStatus');
    if (!providerId || !raw)
      throw new ProviderError('permanent', 'bad_payload', 'Missing status fields');
    const status: VerifiedSmsStatus['status'] =
      raw === 'delivered'
        ? 'delivered'
        : raw === 'failed'
          ? 'failed'
          : raw === 'undelivered'
            ? 'undelivered'
            : 'sent';
    return {
      providerId,
      status,
      errorCode: p.get('ErrorCode') ?? undefined,
      fromE164: p.get('From') ?? undefined,
      toE164: p.get('To') ?? undefined
    };
  }

  parseInbound(headers: WebhookHeaders, rawBody: string): VerifiedInboundSms {
    const p = this.verified(headers, rawBody, TWILIO_INBOUND_PATH);
    const providerId = p.get('MessageSid') ?? p.get('SmsSid');
    const fromE164 = p.get('From');
    const toE164 = p.get('To');
    if (!providerId || !fromE164 || !toE164) {
      throw new ProviderError('permanent', 'bad_payload', 'Missing inbound fields');
    }
    const body = p.get('Body') ?? '';
    return {
      providerId,
      fromE164,
      toE164,
      body,
      isStop: isStopKeyword(body),
      isHelp: isHelpKeyword(body)
    };
  }
}
