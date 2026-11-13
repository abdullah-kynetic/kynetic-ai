import { getVoiceProvider, isVoiceProviderId } from '@/server/calls/provider';
import { handleVoiceWebhook } from '@/server/calls/hooks';
import { AppError } from '@/server/errors';
import { RATE_LIMITS } from '@/server/security/rate-limit';
import { clientIp, withApi } from '@/server/security/with-api';

type Ctx = { params: Promise<{ provider: string }> };

export const POST = withApi(
  async (request, ctx: Ctx) => {
    const { provider: id } = await ctx.params;
    const provider = isVoiceProviderId(id) ? getVoiceProvider(id) : null;
    if (!provider) throw new AppError('NOT_FOUND');
    return handleVoiceWebhook(request, { provider });
  },
  {
    rateLimit: RATE_LIMITS.providerWebhookSource,
    rateLimitSubject: (request) => `voice:${clientIp(request)}`
  }
);
