import { createHmac, timingSafeEqual } from 'node:crypto';
import { ProviderError } from '../errors';
import type { WebhookHeaders } from '../voice/types';
import type { EmailProvider, SendEmailInput, VerifiedEmailEvent } from './types';

const API_URL = 'https://api.resend.com/emails';
/** Svix-style timestamp window (SECURITY 3.6 item 2). */
const TOLERANCE_S = 300;

const KINDS: Record<string, VerifiedEmailEvent['kind']> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained'
};

export type ResendOptions = {
  apiKey: string;
  webhookSecret: string;
  fetch?: typeof fetch;
  now?: () => Date;
};

/** Resend adapter (ARCHITECTURE 7). Reach it only through the outbound gate's dispatch. */
export class ResendEmailProvider implements EmailProvider {
  readonly id = 'resend' as const;
  private readonly doFetch: typeof fetch;
  private readonly now: () => Date;

  constructor(private readonly opts: ResendOptions) {
    this.doFetch = opts.fetch ?? fetch;
    this.now = opts.now ?? (() => new Date());
  }

  async send(i: SendEmailInput): Promise<{ providerId: string }> {
    let res: Response;
    try {
      res = await this.doFetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': i.idempotencyKey
        },
        body: JSON.stringify({
          from: `${i.fromName} <${i.fromAddress}>`,
          to: [i.to],
          subject: i.subject,
          html: i.html,
          text: i.text
        })
      });
    } catch {
      throw new ProviderError('transient', 'network', 'Resend could not be reached');
    }
    if (!res.ok) {
      const kind = res.status === 401 || res.status === 403 ? 'config' : undefined;
      const transient = res.status === 429 || res.status >= 500;
      throw new ProviderError(
        kind ?? (transient ? 'transient' : 'permanent'),
        `http_${res.status}`,
        `Resend answered ${res.status}`
      );
    }
    const body = (await res.json().catch(() => null)) as { id?: string } | null;
    if (!body?.id) throw new ProviderError('transient', 'bad_response', 'Resend sent no id');
    return { providerId: body.id };
  }

  /** Verifies the Svix signature, then maps the event. Types we do not act on throw `ignored_event`. */
  parseWebhook(headers: WebhookHeaders, rawBody: string): VerifiedEmailEvent {
    this.verify(headers, rawBody);
    let evt: { type?: string; data?: { email_id?: string; to?: string[] } };
    try {
      evt = JSON.parse(rawBody);
    } catch {
      throw new ProviderError('permanent', 'bad_payload', 'Webhook body is not JSON');
    }
    const kind = KINDS[evt.type ?? ''];
    if (!kind) throw new ProviderError('permanent', 'ignored_event', 'Event type not handled');
    const providerId = evt.data?.email_id;
    const address = evt.data?.to?.[0];
    if (!providerId || !address) {
      throw new ProviderError('permanent', 'bad_payload', 'Event lacks email id or recipient');
    }
    return { providerId, kind, address: address.trim().toLowerCase() };
  }

  private verify(headers: WebhookHeaders, rawBody: string): void {
    const fail = () => new ProviderError('permanent', 'bad_signature', 'Signature check failed');
    const id = headers['svix-id'];
    const ts = headers['svix-timestamp'];
    const sigs = headers['svix-signature'];
    if (!id || !ts || !sigs) throw fail();
    const age = Math.abs(this.now().getTime() / 1000 - Number(ts));
    if (!Number.isFinite(age) || age > TOLERANCE_S) throw fail();
    const key = Buffer.from(this.opts.webhookSecret.replace(/^whsec_/, ''), 'base64');
    const expected = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest();
    const ok = sigs.split(' ').some((part) => {
      const [version, sig] = part.split(',');
      if (version !== 'v1' || !sig) return false;
      const got = Buffer.from(sig, 'base64');
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
    if (!ok) throw fail();
  }
}
