import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

// kst_<16 hex prefix>_<64 hex secret>. The prefix is the lookup key; only sha256(secret) is stored.
const TOKEN_RE = /^kst_([0-9a-f]{16})_([0-9a-f]{64})$/;

export type NewServiceToken = { token: string; prefix: string; keyHash: string };

export function generateServiceToken(): NewServiceToken {
  const prefix = randomBytes(8).toString('hex');
  const secret = randomBytes(32).toString('hex');
  return { token: `kst_${prefix}_${secret}`, prefix, keyHash: hashSecret(secret) };
}

export function hashSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function parseServiceToken(raw: string): { prefix: string; keyHash: string } | null {
  const m = TOKEN_RE.exec(raw);
  return m ? { prefix: m[1], keyHash: hashSecret(m[2]) } : null;
}

export function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Pulls the token out of `Authorization: Bearer <token>`. Anything else is no credential. */
export function bearerFromHeader(header: string | null | undefined): string | null {
  if (!header) return null;
  const m = /^Bearer ([^\s]+)$/i.exec(header.trim());
  return m ? m[1] : null;
}
