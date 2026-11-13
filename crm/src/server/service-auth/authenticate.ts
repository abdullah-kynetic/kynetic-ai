import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb, type Db } from '../db/client';
import { serviceTokens, tenants } from '../db/schema';
import { withTenant } from '../tenancy';
import { bearerFromHeader, generateServiceToken, hashesEqual, parseServiceToken } from './token';

export type ServiceContext = { tenantId: string; tokenId: string; scopes: string[] };

type Opts = { db?: Db };

/**
 * Resolves a bearer token to the one tenant it belongs to, or null (the caller answers 401). The
 * tenant comes from the token row, never from the request. Unknown, malformed, wrong-secret and
 * revoked tokens are indistinguishable to the caller. A scope is checked only when one is asked for.
 */
export async function authenticateServiceToken(
  authorization: string | null | undefined,
  opts: Opts & { requiredScope?: string } = {}
): Promise<ServiceContext | null> {
  const raw = bearerFromHeader(authorization);
  const parsed = raw ? parseServiceToken(raw) : null;
  if (!parsed) return null;
  const db = opts.db ?? getDb();

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
  return { tenantId: row.tenant_id, tokenId: row.id, scopes: row.scopes.filter(Boolean) };
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
    const svc = await authenticateServiceToken(req.headers.get('authorization'), opts);
    if (!svc) {
      return Response.json(
        { error: 'unauthorized' },
        { status: 401, headers: { 'WWW-Authenticate': 'Bearer', 'Cache-Control': 'no-store' } }
      );
    }
    return handler(req, svc, ...rest);
  };
}
