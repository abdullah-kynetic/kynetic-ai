import { getSmsProvider } from '@/server/messaging/provider';
import { handleTwilioStatus } from '@/server/messaging/twilio-hooks';
import { RATE_LIMITS } from '@/server/security/rate-limit';
import { withApi } from '@/server/security/with-api';

export const POST = withApi(
  (request) => handleTwilioStatus(request, { provider: getSmsProvider() }),
  {
    rateLimit: RATE_LIMITS.providerWebhookSource,
    rateLimitSubject: () => 'twilio'
  }
);
