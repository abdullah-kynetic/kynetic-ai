import { createHash } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import type { Db, Tx } from '../db/client';
import { serviceIdempotency } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { type ServiceContext, withServiceTenant } from './authenticate';

const KEY_RE = /^[A-Za-z0-9_-]{8,128}$/;

export type IdempotentResult = { status: number; body: unknown };

/** The Idempotency-Key header, or a 400. Required on every service write. */
export function idempotencyKeyFrom(request: Request): string {
  const key = request.headers.get('idempotency-key')?.trim() ?? '';
  if (!KEY_RE.test(key)) {
    throw new ValidationError({
      'idempotency-key': ['required_8_to_128_url_safe_chars']
    });
  }
  return key;
}

/**
 * Runs a service write at most once per (tenant, Idempotency-Key). The record commits in the same
 * transaction as the write, so a failed write leaves no record and can be retried with the same key.
 * The same key with the same request replays the stored response (`replayed: true`). The same key
 * with a different request is a 409. The hash covers method, path and the raw body, so a client must
 * retry byte-for-byte. Records are purged after 24 hours.
 */
export async function runIdempotent(
  svc: ServiceContext,
  request: Request,
  rawBody: string,
  fn: (tx: Tx) => Promise<IdempotentResult>,
  opts: { db?: Db } = {}
): Promise<IdempotentResult & { replayed: boolean }> {
  const key = idempotencyKeyFrom(request);
  const method = request.method.toUpperCase();
  const path = new URL(request.url).pathname;
  const requestHash = createHash('sha256').update(`${method}\n${path}\n${rawBody}`).digest('hex');

  return withServiceTenant(
    svc,
    async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${`${svc.tenantId}:idem:${key}`}, 0))`
      );
      const [prior] = await tx
        .select()
        .from(serviceIdempotency)
        .where(eq(serviceIdempotency.key, key))
        .limit(1);
      if (prior) {
        if (prior.requestHash !== requestHash) {
          throw new AppError('CONFLICT', {
            message: 'This Idempotency-Key was already used for a different request.'
          });
        }
        return { status: prior.status, body: prior.response, replayed: true };
      }
      const result = await fn(tx);
      await tx.insert(serviceIdempotency).values({
        tenantId: svc.tenantId,
        tokenId: svc.tokenId,
        adminKeyId: svc.adminKeyId ?? null,
        key,
        method,
        path,
        requestHash,
        status: result.status,
        response: result.body ?? {}
      });
      return { ...result, replayed: false };
    },
    opts
  );
}

/** Builds the Response for a runIdempotent result. */
export function idempotentResponse(r: IdempotentResult & { replayed: boolean }): Response {
  return Response.json(r.body, {
    status: r.status,
    headers: {
      'Cache-Control': 'no-store',
      ...(r.replayed ? { 'Idempotent-Replay': 'true' } : {})
    }
  });
}

/** Deletes records older than 24 hours. Worker only (SECURITY DEFINER function). */
export async function purgeServiceIdempotency(db: Db): Promise<number> {
  const rows = await db.execute<{ n: number }>(sql`select service_idempotency_purge() as n`);
  return Number(rows[0]?.n ?? 0);
}
