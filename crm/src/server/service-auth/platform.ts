import { sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/client';
import { AppError, errorResponse, RateLimitedError } from '../errors';
import { SERVICE_TOKEN_SCOPES } from './scopes';
import type { PlatformContext } from '../tenancy/context';
import { consumeRateLimit, RATE_LIMITS } from '../security/rate-limit';
import { clientIp } from '../security/with-api';
import { addressAllowed } from './address';
import { ADMIN_CLIENT_HEADER, serviceApiEnabled } from './authenticate';
import { bearerFromHeader, hashesEqual, parseAdminKey } from './token';

// Platform routes (E). The owner's admin key only, with no X-Kynetic-Client header: these work across
// every client. A client token fails here with 401, because it is not an admin key. The owner behind
// the key was issued only to the owner (asOwner at issue time), and the portal's own functions still
// check the role themselves. The users table is not readable here without a session context, so the
// owner's current role is not re-checked on each call: a demoted owner keeps access until the key is revoked.

export type PlatformService = {
  adminKeyId: string;
  userId: string;
};

/** The owner's platform context for the portal's roll-up functions. */
export function platformContext(plat: PlatformService): PlatformContext & { role: 'admin' } {
  return { userId: plat.userId, role: 'admin' };
}

async function authenticatePlatformKey(
  authorization: string | null,
  request: Request,
  db: Db
): Promise<PlatformService | null> {
  const raw = bearerFromHeader(authorization);
  const parsed = raw ? parseAdminKey(raw) : null;
  if (!raw || !parsed) return null;
  const rows = await db.execute<{
    id: string;
    key_hash: string;
    allowed_cidrs: string[];
    revoked_at: string | null;
  }>(sql`select * from admin_api_key_lookup(${parsed.prefix})`);
  const row = rows[0];
  if (!row || !hashesEqual(row.key_hash, parsed.keyHash) || row.revoked_at) return null;
  if (!(await serviceApiEnabled(db))) return null;
  if (row.allowed_cidrs.length > 0 && !addressAllowed(clientIp(request), row.allowed_cidrs))
    return null;
  const [owner] = await db.execute<{ owner: string | null }>(
    sql`select admin_api_key_owner(${row.id}::uuid) as owner`
  );
  if (!owner?.owner) return null;
  await db.execute(sql`select admin_api_key_touch(${row.id}::uuid)`);
  return { adminKeyId: row.id, userId: owner.owner };
}

/**
 * Wraps a platform route. A request that names a client (X-Kynetic-Client) is refused with 400, so a
 * caller cannot think a platform call was scoped to one client. Failed auth is 401, as elsewhere.
 */
export function withPlatformAuth<A extends unknown[]>(
  handler: (req: Request, plat: PlatformService, ...rest: A) => Promise<Response> | Response,
  opts: { db?: Db; requiredScope?: string } = {}
) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    const db = opts.db ?? getDb();
    if (req.headers.get(ADMIN_CLIENT_HEADER)) {
      return Response.json(
        { error: 'platform_no_client_header' },
        { status: 400, headers: { 'Cache-Control': 'no-store' } }
      );
    }
    const plat = await authenticatePlatformKey(req.headers.get('authorization'), req, db);
    if (!plat) {
      return Response.json(
        { error: 'unauthorized' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } }
      );
    }
    const rule = ['GET', 'HEAD'].includes(req.method)
      ? RATE_LIMITS.serviceRead
      : RATE_LIMITS.serviceWrite;
    const limit = await consumeRateLimit(db, rule, plat.adminKeyId);
    if (!limit.allowed) return errorResponse(new RateLimitedError(limit.retryAfterSeconds));
    // The owner's admin key holds every scope; the check is kept so a route names what it needs.
    if (
      opts.requiredScope &&
      !(SERVICE_TOKEN_SCOPES as readonly string[]).includes(opts.requiredScope)
    )
      return errorResponse(new AppError('FORBIDDEN'));
    return handler(req, plat, ...rest);
  };
}
