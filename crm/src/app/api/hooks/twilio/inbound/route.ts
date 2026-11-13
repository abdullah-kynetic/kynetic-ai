import { getSmsProvider } from '@/server/messaging/provider';
import { handleTwilioInbound } from '@/server/messaging/twilio-hooks';
import { RATE_LIMITS } from '@/server/security/rate-limit';
import { clientIp, withApi } from '@/server/security/with-api';

export const POST = withApi(
  (request) => handleTwilioInbound(request, { provider: getSmsProvider() }),
  {
    rateLimit: RATE_LIMITS.providerWebhookSource,
    rateLimitSubject: (request) => `twilio:${clientIp(request)}`
  }
);
