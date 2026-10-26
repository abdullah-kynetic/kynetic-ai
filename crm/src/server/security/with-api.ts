import { getDb } from '../db/client';
import { getEnv } from '../env';
import { errorResponse } from '../errors';
import { assertSameOrigin } from './origin';
import { enforceRateLimit, type RateLimitRule } from './rate-limit';

export type ApiOptions = {
  /** Rate limit to apply; the subject comes from `rateLimitSubject` (defaults to the client IP). */
  rateLimit?: RateLimitRule;
  rateLimitSubject?: (request: Request) => string | Promise<string>;
};

export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || 'unknown';
}

/**
 * Wraps a route handler: Origin check, optional rate limit, then the handler. Anything thrown
 * becomes the standard error body. Authentication and Zod parsing stay in the handler.
 */
export function withApi<Ctx>(
  handler: (request: Request, ctx: Ctx) => Promise<Response> | Response,
  options: ApiOptions = {}
): (request: Request, ctx: Ctx) => Promise<Response> {
  return async (request, ctx) => {
    try {
      assertSameOrigin(request, getEnv().APP_BASE_URL);
      if (options.rateLimit) {
        const subject = await (options.rateLimitSubject ?? clientIp)(request);
        await enforceRateLimit(getDb(), options.rateLimit, subject);
      }
      return await handler(request, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
