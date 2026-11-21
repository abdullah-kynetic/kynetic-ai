import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/client';
import { serviceTokens, tenants } from '../db/schema';
import { errorResponse, RateLimitedError } from '../errors';
import { withTenant } from '../tenancy';
import { consumeRateLimit, RATE_LIMITS } from '../security/rate-limit';
import { SERVICE_TOKEN_SCOPES } from './scopes';
import { addressAllowed } from './address';
import {
  bearerFromHeader,
  generateServiceToken,
  hashesEqual,
  parseAdminKey,
  parseServiceToken
} from './token';
import { clientIp } from '../security/with-api';

export type ServiceContext = {
  tenantId: string;
  /** The client token, or null when the call came from the owner's admin key. */
  tokenId: string | null;
  /** The admin key, or null for a client token. Exactly one of the two is set. */
  adminKeyId?: string | null;
  scopes: string[];
};

/** Header an admin key uses to say which client it is acting for (the client's slug). */
export const ADMIN_CLIENT_HEADER = 'x-kynetic-client';

async function serviceApiEnabled(db: Db): Promise<boolean> {
  const rows = await db.execute<{ on: boolean }>(sql`select service_api_enabled() as on`);
  return rows[0]?.on === true;
}

type Opts = { db?: Db };

/**
 * Resolves a bearer token to the one tenant it belongs to, or null (the caller answers 401). The
 * tenant comes from the token row, never from the request. Unknown, malformed, wrong-secret and
 * revoked tokens are indistinguishable to the caller. A scope is checked only when one is asked for.
 */
export async function authenticateServiceToken(
  authorization: string | null | undefined,
  opts: Opts & { requiredScope?: string; request?: Request } = {}
): Promise<ServiceContext | null> {
  const raw = bearerFromHeader(authorization);
  if (!raw) return null;
  const db = opts.db ?? getDb();
  if (raw.startsWith('kad_')) return authenticateAdminKey(raw, db, opts);
  const parsed = parseServiceToken(raw);
  if (!parsed) return null;
  // The owner's stop-all switch also stops every client token.
  if (!(await serviceApiEnabled(db))) return null;

  const rows = await db.execute<{
    id: string;
    tenant_id: string;
    key_hash: string;
    scopes: string[];
    revoked_at: string | null;
  }>(sql`select * from service_token_lookup(${parsed.prefix})`);
  const row = rows[0];
  if (!row || !hashesEqual(row.key_hash, parsed.keyHash) || row.revoked_at) return null;
  if (opts.requiredScope && !row.scopes.includes(opts.requiredScope)) return null;

  // A suspended or offboarded client's tokens stop working at once, even if nobody revoked them.
  const [tenant] = await withTenant(
    { tenantId: row.tenant_id, role: 'system' },
    (tx) => tx.select({ status: tenants.status }).from(tenants).limit(1),
    { db }
  );
  if (!tenant || tenant.status === 'suspended' || tenant.status === 'offboarded') return null;

  await db.execute(sql`select service_token_touch(${row.id}::uuid)`);
  return {
    tenantId: row.tenant_id,
    tokenId: row.id,
    scopes: row.scopes.filter(Boolean)
  };
}

/**
 * The owner's admin key. It acts for ONE client per request, named in the X-Kynetic-Client header, and
 * holds every scope. It must come from an allowed address when the key has an address list. A switched-off
 * API, a revoked key, a wrong address, an unknown client, or a suspended client all look like 401.
 */
async function authenticateAdminKey(
  raw: string,
  db: Db,
  opts: { requiredScope?: string; request?: Request }
): Promise<ServiceContext | null> {
  const parsed = parseAdminKey(raw);
  if (!parsed || !opts.request) return null;
  const rows = await db.execute<{
    id: string;
    key_hash: string;
    allowed_cidrs: string[];
    revoked_at: string | null;
  }>(sql`select * from admin_api_key_lookup(${parsed.prefix})`);
  const row = rows[0];
  if (!row || !hashesEqual(row.key_hash, parsed.keyHash) || row.revoked_at) return null;
  if (!(await serviceApiEnabled(db))) return null;
  // Fail closed: a key with an address list is useless from anywhere else, including an unknown address.
  if (row.allowed_cidrs.length > 0 && !addressAllowed(clientIp(opts.request), row.allowed_cidrs))
    return null;
  const slug = opts.request.headers.get(ADMIN_CLIENT_HEADER)?.trim().toLowerCase() ?? '';
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const client = (
    await db.execute<{ tenant_id: string; status: string }>(
      sql`select * from admin_api_key_client(${slug})`
    )
  )[0];
  if (!client || client.status === 'suspended' || client.status === 'offboarded') return null;
  await db.execute(sql`select admin_api_key_touch(${row.id}::uuid)`);
  return {
    tenantId: client.tenant_id,
    tokenId: null,
    adminKeyId: row.id,
    scopes: [...SERVICE_TOKEN_SCOPES]
  };
}

/** Runs fn in the token's tenant. The role is `system`; RLS still pins every row to that tenant. */
export function withServiceTenant<T>(
  svc: ServiceContext,
  fn: Parameters<typeof withTenant<T>>[1],
  opts: Opts = {}
): Promise<T> {
  return withTenant({ tenantId: svc.tenantId, role: 'system' }, fn, opts);
}

/**
 * Creates a token for one tenant (Kynetic creates it, DATABASE service_tokens). The raw token is
 * returned once and never stored. Call inside the tenant's own context.
 */
export async function issueServiceToken(
  ctx: Parameters<typeof withTenant>[0],
  input: { label: string; scopes: string[] },
  opts: Opts = {}
): Promise<{ id: string; token: string }> {
  const t = generateServiceToken();
  const id = await withTenant(
    ctx,
    async (tx) => {
      const [row] = await tx
        .insert(serviceTokens)
        .values({
          tenantId: ctx.tenantId,
          prefix: t.prefix,
          keyHash: t.keyHash,
          label: input.label,
          scopes: input.scopes
        })
        .returning({ id: serviceTokens.id });
      return row.id;
    },
    opts
  );
  return { id, token: t.token };
}

/** Revokes one token of the context's tenant. Returns false if it was not live in that tenant. */
export async function revokeServiceToken(
  ctx: Parameters<typeof withTenant>[0],
  tokenId: string,
  opts: Opts = {}
): Promise<boolean> {
  const rows = await withTenant(
    ctx,
    (tx) =>
      tx
        .update(serviceTokens)
        .set({ revokedAt: new Date().toISOString() })
        .where(
          and(
            eq(serviceTokens.id, tokenId),
            eq(serviceTokens.tenantId, ctx.tenantId),
            isNull(serviceTokens.revokedAt)
          )
        )
        .returning({ id: serviceTokens.id }),
    opts
  );
  return rows.length > 0;
}

/**
 * Wraps a route handler under /api/service/*. 401 on any failure, with no detail. The handler
 * receives the verified context; it must use withServiceTenant, never a tenant id from the request.
 */
export function withServiceAuth<A extends unknown[]>(
  handler: (req: Request, svc: ServiceContext, ...rest: A) => Promise<Response> | Response,
  opts: Opts & { requiredScope?: string } = {}
) {
  return async (req: Request, ...rest: A): Promise<Response> => {
    const svc = await authenticateServiceToken(req.headers.get('authorization'), {
      ...opts,
      request: req
    });
    if (!svc) {
      return Response.json(
        { error: 'unauthorized' },
        {
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer',
            'Cache-Control': 'no-store'
          }
        }
      );
    }
    // Per token, after authentication, so unauthenticated floods cannot burn a client's budget.
    const rule = ['GET', 'HEAD'].includes(req.method)
      ? RATE_LIMITS.serviceRead
      : RATE_LIMITS.serviceWrite;
    const limit = await consumeRateLimit(
      opts.db ?? getDb(),
      rule,
      (svc.tokenId ?? svc.adminKeyId) as string
    );
    if (!limit.allowed) return errorResponse(new RateLimitedError(limit.retryAfterSeconds));
    return handler(req, svc, ...rest);
  };
}
