import { enforceRateLimit, RATE_LIMITS } from '../security/rate-limit';
import { clientIp } from '../security/with-api';
import { getDb, type Db } from '../db/client';

const AUTH_RATE_LIMITED_PATHS = [
  '/sign-in/',
  '/sign-up/',
  '/magic-link/verify',
  '/email-otp/',
  '/request-password-reset',
  '/forget-password',
  '/send-verification-email'
];

const EMAIL_LIMITED_PATHS = new Set(['/sign-in/magic-link', '/email-otp/send']);

function authPath(request: Request): string | undefined {
  const pathname = new URL(request.url).pathname;
  const routePrefix = '/api/auth';
  if (!pathname.startsWith(`${routePrefix}/`)) return undefined;
  const path = pathname.slice(routePrefix.length);
  return AUTH_RATE_LIMITED_PATHS.some((prefix) => path.startsWith(prefix)) ? path : undefined;
}

/** Apply the shared PostgreSQL limits before a sign-in or magic-link request reaches Better Auth. */
export async function enforceAuthRequestRateLimits(
  request: Request,
  db: Db = getDb()
): Promise<void> {
  const path = authPath(request);
  if (!path) return;

  await enforceRateLimit(db, RATE_LIMITS.authIp, clientIp(request));
  if (request.method !== 'POST' || !EMAIL_LIMITED_PATHS.has(path)) return;

  const payload = (await request
    .clone()
    .json()
    .catch(() => null)) as { email?: unknown } | null;
  if (typeof payload?.email === 'string' && payload.email.trim()) {
    await enforceRateLimit(db, RATE_LIMITS.authEmail, payload.email);
  }
}
