import { createHash } from 'node:crypto';
import { lt, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { rateLimits } from '../db/schema';
import { RateLimitedError } from '../errors';

// Postgres-backed fixed-window limiter (SECURITY 5.4, no Redis). One row per key and window; the
// counter is bumped with a single atomic upsert, so concurrent requests cannot undercount. A fixed
// window can pass up to twice the limit across a boundary; that is accepted for these limits.

export type RateLimitRule = { name: string; limit: number; windowSeconds: number };

// Starting values from SECURITY 5.4, tuned in M10 load testing. The lead webhook's daily cap and the
// outbound caps are not here: the cap has no number yet, and outbound caps belong to canContact.
export const RATE_LIMITS = {
  authIp: { name: 'auth_ip', limit: 5, windowSeconds: 60 },
  authEmail: { name: 'auth_email', limit: 10, windowSeconds: 3600 },
  apiUser: { name: 'api_user', limit: 120, windowSeconds: 60 },
  leadWebhookTenant: { name: 'lead_webhook_tenant', limit: 60, windowSeconds: 60 },
  providerWebhookSource: { name: 'provider_webhook_source', limit: 600, windowSeconds: 60 },
  exportImportTenant: { name: 'export_import_tenant', limit: 5, windowSeconds: 3600 },
  searchUser: { name: 'search_user', limit: 30, windowSeconds: 60 },
  impersonationStart: { name: 'impersonation_start', limit: 20, windowSeconds: 3600 }
} as const satisfies Record<string, RateLimitRule>;

export type RateLimitResult = {
  allowed: boolean;
  count: number;
  remaining: number;
  retryAfterSeconds: number;
};

/** Subjects are IPs, emails and ids. They are hashed so the table holds no personal data. */
function keyFor(rule: RateLimitRule, subject: string): string {
  const digest = createHash('sha256').update(subject.trim().toLowerCase()).digest('hex');
  return `${rule.name}:${digest.slice(0, 32)}`;
}

/** Counts one hit against the rule for this subject and says whether it is within the limit. */
export async function consumeRateLimit(
  db: Db,
  rule: RateLimitRule,
  subject: string,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const windowMs = rule.windowSeconds * 1000;
  const startMs = Math.floor(now.getTime() / windowMs) * windowMs;
  const windowStart = new Date(startMs);
  const expiresAt = new Date(startMs + windowMs);

  const rows = await db
    .insert(rateLimits)
    .values({ key: keyFor(rule, subject), windowStart, count: 1, expiresAt })
    .onConflictDoUpdate({
      target: [rateLimits.key, rateLimits.windowStart],
      set: { count: sql`${rateLimits.count} + 1` }
    })
    .returning({ count: rateLimits.count });

  const count = rows[0].count;
  return {
    allowed: count <= rule.limit,
    count,
    remaining: Math.max(0, rule.limit - count),
    retryAfterSeconds: Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000))
  };
}

/** Throws RateLimitedError (429 with Retry-After) when the subject is over the limit. */
export async function enforceRateLimit(
  db: Db,
  rule: RateLimitRule,
  subject: string,
  now: Date = new Date()
): Promise<RateLimitResult> {
  const result = await consumeRateLimit(db, rule, subject, now);
  if (!result.allowed) throw new RateLimitedError(result.retryAfterSeconds);
  return result;
}

export function enforceApiRateLimit(db: Db, userId: string, now?: Date) {
  return enforceRateLimit(db, RATE_LIMITS.apiUser, userId, now);
}

export function enforceSearchRateLimit(db: Db, userId: string, now?: Date) {
  return enforceRateLimit(db, RATE_LIMITS.searchUser, userId, now);
}

/** Import batches and CSV exports share the per-tenant hourly budget from SECURITY 5.4. */
export function enforceExportImportRateLimit(db: Db, tenantId: string, now?: Date) {
  return enforceRateLimit(db, RATE_LIMITS.exportImportTenant, tenantId, now);
}

/** Hourly. The worker schedules this; counters are short-lived. */
export const RATE_LIMIT_PURGE_CRON = '15 * * * *';

/** Counters are short-lived. The worker calls this on RATE_LIMIT_PURGE_CRON. */
export async function purgeExpiredRateLimits(db: Db, now: Date = new Date()): Promise<number> {
  const rows = await db
    .delete(rateLimits)
    .where(lt(rateLimits.expiresAt, now))
    .returning({ key: rateLimits.key });
  return rows.length;
}
