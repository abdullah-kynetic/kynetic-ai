import { TwilioSmsProvider } from '../adapters/sms/twilio';
import { FakeSmsProvider } from '../adapters/sms/fake';
import type { SmsProvider } from '../adapters/sms/types';
import { getEnv } from '../env';

let cached: SmsProvider | undefined;

/**
 * Twilio when both credentials are set. Without them, only development and test fall back to the
 * in-memory fake; production fails closed so a missing key cannot silently drop messages.
 */
export function getSmsProvider(): SmsProvider {
  if (cached) return cached;
  const env = getEnv();
  if (env.PROVIDER_MODE === 'stub') {
    cached = new FakeSmsProvider();
  } else if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    cached = new TwilioSmsProvider({
      accountSid: env.TWILIO_ACCOUNT_SID,
      authToken: env.TWILIO_AUTH_TOKEN,
      publicBaseUrl: env.APP_BASE_URL
    });
  } else if (env.NODE_ENV === 'production') {
    throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are required in production');
  } else {
    cached = new FakeSmsProvider();
  }
  return cached;
}
