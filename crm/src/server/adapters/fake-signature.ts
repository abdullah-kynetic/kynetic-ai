import { ProviderError } from './errors';
import type { WebhookHeaders } from './voice/types';

/** Header the fakes require on webhook bodies. Real providers verify real signatures. */
export const FAKE_SIGNATURE_HEADER = 'x-fake-signature';
export const FAKE_SIGNATURE_VALUE = 'valid';

export function verifyFakeSignature(headers: WebhookHeaders): void {
  if (headers[FAKE_SIGNATURE_HEADER] !== FAKE_SIGNATURE_VALUE) {
    throw new ProviderError('permanent', 'bad_signature', 'Webhook signature verification failed');
  }
}
