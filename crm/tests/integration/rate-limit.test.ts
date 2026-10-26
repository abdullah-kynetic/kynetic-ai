import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { RateLimitedError } from '@/server/errors';
import {
  consumeRateLimit,
  enforceRateLimit,
  purgeExpiredRateLimits
} from '@/server/security/rate-limit';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
const rule = { name: 'test_rule', limit: 3, windowSeconds: 60 };
const t0 = new Date('2026-10-26T12:00:10Z');

beforeAll(async () => {
  tdb = await createTestDatabase();
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

describe('Postgres rate limiter (SECURITY 5.4)', () => {
  it('allows up to the limit, then refuses with the seconds left in the window', async () => {
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await consumeRateLimit(db, rule, '1.1.1.1', t0));
    expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
    expect(results.map((r) => r.remaining)).toEqual([2, 1, 0, 0]);
    expect(results[3].retryAfterSeconds).toBe(50);
  });

  it('enforceRateLimit throws RATE_LIMITED (429) when over', async () => {
    for (let i = 0; i < 3; i++) await enforceRateLimit(db, rule, '2.2.2.2', t0);
    const err = await enforceRateLimit(db, rule, '2.2.2.2', t0).catch((e) => e);
    expect(err).toBeInstanceOf(RateLimitedError);
    expect(err.status).toBe(429);
    expect(err.headers['Retry-After']).toBe('50');
  });

  it('counts per subject and per rule', async () => {
    await consumeRateLimit(db, rule, '3.3.3.3', t0);
    expect((await consumeRateLimit(db, rule, '4.4.4.4', t0)).count).toBe(1);
    expect((await consumeRateLimit(db, { ...rule, name: 'other' }, '3.3.3.3', t0)).count).toBe(1);
  });

  it('starts fresh in the next window', async () => {
    for (let i = 0; i < 5; i++) await consumeRateLimit(db, rule, '5.5.5.5', t0);
    const next = await consumeRateLimit(db, rule, '5.5.5.5', new Date('2026-10-26T12:01:00Z'));
    expect(next).toMatchObject({ allowed: true, count: 1 });
  });

  it('does not undercount under concurrency', async () => {
    const all = await Promise.all(
      Array.from({ length: 20 }, () => consumeRateLimit(db, rule, '6.6.6.6', t0))
    );
    expect(all.filter((r) => r.allowed)).toHaveLength(3);
    expect(Math.max(...all.map((r) => r.count))).toBe(20);
  });

  it('stores a hash, not the subject', async () => {
    const rows = await tdb.admin`select key from rate_limits where key like 'test_rule:%'`;
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r.key).toMatch(/^test_rule:[0-9a-f]{32}$/);
  });

  it('purges expired counters only', async () => {
    const purged = await purgeExpiredRateLimits(db, new Date('2026-10-26T12:01:30Z'));
    expect(purged).toBeGreaterThan(0);
    const [{ n }] =
      await tdb.admin`select count(*)::int as n from rate_limits where window_start = ${new Date('2026-10-26T12:01:00Z')}`;
    expect(n).toBe(1);
    const [{ old }] =
      await tdb.admin`select count(*)::int as old from rate_limits where expires_at < ${new Date('2026-10-26T12:01:30Z')}`;
    expect(old).toBe(0);
  });

  it('kynetic_auth has no access to the table', async () => {
    await expect(tdb.auth`select 1 from rate_limits`).rejects.toThrow(/permission denied/);
  });
});
