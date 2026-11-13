import { getDb, type Db } from '../db/client';
import { getSessionUser } from '../auth';
import { getEnv } from '../env';
import { errorResponse } from '../errors';
import { assertSameOrigin } from './origin';
import { enforceApiRateLimit, enforceRateLimit, type RateLimitRule } from './rate-limit';

export type ApiOptions = {
  /** Rate limit to apply; the subject comes from `rateLimitSubject` (defaults to the client IP). */
  rateLimit?: RateLimitRule;
  rateLimitSubject?: (request: Request) => string | Promise<string>;
  /** Test seam and opt-out for unauthenticated provider/service endpoints. */
  authenticatedUserRateLimit?: false;
  resolveUser?: (headers: Headers) => Promise<{ id: string } | null>;
  rateLimitDb?: Db;
};

/**
 * The visitor address. Caddy appends the address it saw (Cloudflare's CF-Connecting-IP) to whatever
 * X-Forwarded-For the visitor sent, so the LAST entry is the trustworthy one; the first is chosen by
 * the visitor and would let anyone dodge the per-IP limits and forge audit addresses.
 */
export function lastForwardedAddress(header: string | null | undefined): string | undefined {
  const parts = header?.split(',').map((part) => part.trim());
  return parts?.at(-1) || undefined;
}

export function clientIp(request: Request): string {
  return (
    lastForwardedAddress(request.headers.get('x-forwarded-for')) ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
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
        await enforceRateLimit(options.rateLimitDb ?? getDb(), options.rateLimit, subject);
      } else if (
        options.authenticatedUserRateLimit !== false &&
        request.headers.has('cookie') &&
        !/^\/api\/(hooks|service)\//.test(new URL(request.url).pathname)
      ) {
        const user = await (options.resolveUser ?? getSessionUser)(request.headers);
        if (user) await enforceApiRateLimit(options.rateLimitDb ?? getDb(), user.id);
      }
      return await handler(request, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
