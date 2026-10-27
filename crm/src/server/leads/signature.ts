import { createHmac, timingSafeEqual } from 'node:crypto';

// Lead webhook signing (SECURITY 3.6): HMAC-SHA256 over `${timestamp}.${rawBody}` with the tenant's
// secret, hex encoded, sent as `X-Kynetic-Timestamp` (unix seconds) and `X-Kynetic-Signature:
// sha256=<hex>`. The 5-minute window limits replay; the webhook_events unique key stops the rest.

export const TIMESTAMP_HEADER = 'x-kynetic-timestamp';
export const SIGNATURE_HEADER = 'x-kynetic-signature';
export const SIGNATURE_WINDOW_SECONDS = 300;

export function signLeadBody(secret: string, timestamp: number | string, rawBody: string): string {
  return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')}`;
}

/** True only for a fresh timestamp and a matching signature. Never says which part failed. */
export function verifyLeadSignature(input: {
  secret: string;
  timestamp: string | null;
  signature: string | null;
  rawBody: string;
  now?: Date;
}): boolean {
  const { secret, timestamp, signature, rawBody } = input;
  const nowSeconds = Math.floor((input.now ?? new Date()).getTime() / 1000);
  // Always compute the digest so a missing header and a wrong one cost the same.
  const expected = Buffer.from(signLeadBody(secret, timestamp ?? '', rawBody));
  const given = Buffer.from(signature ?? '');
  const sameLength = given.length === expected.length;
  const match = timingSafeEqual(sameLength ? given : expected, expected) && sameLength;
  if (!timestamp || !/^\d{1,12}$/.test(timestamp)) return false;
  const fresh = Math.abs(nowSeconds - Number(timestamp)) <= SIGNATURE_WINDOW_SECONDS;
  return match && fresh;
}
