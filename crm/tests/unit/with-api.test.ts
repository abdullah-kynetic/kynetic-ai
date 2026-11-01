import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RateLimitedError } from '@/server/errors';

const calls: unknown[][] = [];
const apiCalls: unknown[][] = [];
let behavior: () => void = () => {};
const enforceRateLimit = async (...args: unknown[]) => {
  calls.push(args);
  behavior();
};
const enforceApiRateLimit = async (...args: unknown[]) => {
  apiCalls.push(args);
  behavior();
};
vi.mock('@/server/env', () => ({ getEnv: () => ({ APP_BASE_URL: 'https://app.example.test' }) }));
vi.mock('@/server/db/client', () => ({ getDb: () => ({}) }));
vi.mock('@/server/auth', () => ({ getSessionUser: async () => ({ id: 'synthetic-user' }) }));
vi.mock('@/server/security/rate-limit', () => ({ enforceRateLimit, enforceApiRateLimit }));

const { withApi } = await import('@/server/security/with-api');
const rule = { name: 't', limit: 1, windowSeconds: 60 };
const post = (headers: Record<string, string> = {}) =>
  new Request('https://app.example.test/api/x', { method: 'POST', headers });

beforeEach(() => {
  calls.length = 0;
  apiCalls.length = 0;
  behavior = () => {};
});

describe('withApi', () => {
  const ok = withApi(async () => Response.json({ ok: true }), { rateLimit: rule });

  it('refuses a state-changing request without Origin before touching the handler', async () => {
    const handler = vi.fn();
    const res = await withApi(handler)(post(), undefined);
    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('FORBIDDEN');
    expect(handler).not.toHaveBeenCalled();
    expect(calls).toEqual([]);
  });

  it('runs the handler for our own Origin', async () => {
    const res = await ok(
      post({ origin: 'https://app.example.test', 'x-forwarded-for': '1.2.3.4, 5.6.7.8' }),
      undefined
    );
    expect(res.status).toBe(200);
    expect(calls).toEqual([[{}, rule, '1.2.3.4']]);
  });

  it('returns 429 with Retry-After when the limit is hit', async () => {
    behavior = () => {
      throw new RateLimitedError(30);
    };
    const res = await ok(post({ origin: 'https://app.example.test' }), undefined);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('30');
    expect((await res.json()).error.code).toBe('RATE_LIMITED');
  });

  it('applies the shared per-user API bucket to cookie-authenticated calls', async () => {
    const res = await withApi(async () => Response.json({ ok: true }))(
      new Request('https://app.example.test/api/x', { headers: { cookie: 'synthetic=session' } }),
      undefined
    );
    expect(res.status).toBe(200);
    expect(apiCalls).toEqual([[{}, 'synthetic-user']]);
  });

  it('turns a thrown surprise into INTERNAL without its message', async () => {
    const res = await withApi(() => {
      throw new Error('relation "secret_table" does not exist');
    })(new Request('https://app.example.test/api/x'), undefined);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain('secret_table');
  });
});
