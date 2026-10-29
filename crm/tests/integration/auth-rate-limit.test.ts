import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { enforceAuthRequestRateLimits } from '@/server/auth/rate-limit';
import type { Db } from '@/server/db/client';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;

beforeAll(async () => {
  tdb = await createTestDatabase();
  db = (await import('@/server/db/client')).createDb(tdb.app);
});

afterAll(async () => {
  await tdb?.drop();
});

const magicLinkRequest = (ip: string, email: string) =>
  new Request('https://portal.example.test/api/auth/sign-in/magic-link', {
    method: 'POST',
    headers: { 'x-forwarded-for': ip, 'content-type': 'application/json' },
    body: JSON.stringify({ email })
  });

describe('M10-01 auth rate limits (SECURITY 5.4)', () => {
  it('limits sign-in and magic-link requests to five per minute per IP', async () => {
    for (let i = 0; i < 5; i++) {
      await enforceAuthRequestRateLimits(
        magicLinkRequest('198.51.100.10', `owner-${i}@example.test`),
        db
      );
    }
    await expect(
      enforceAuthRequestRateLimits(magicLinkRequest('198.51.100.10', 'next@example.test'), db)
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('limits magic-link requests to ten per hour per normalized email', async () => {
    for (let i = 0; i < 10; i++) {
      await enforceAuthRequestRateLimits(
        magicLinkRequest(`198.51.100.${20 + i}`, 'Owner@Example.test'),
        db
      );
    }
    await expect(
      enforceAuthRequestRateLimits(magicLinkRequest('198.51.100.99', 'owner@example.test'), db)
    ).rejects.toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('does not charge sign-out or verification callbacks to sign-in limits', async () => {
    const request = new Request('https://portal.example.test/api/auth/sign-out', {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.50' }
    });
    await expect(enforceAuthRequestRateLimits(request, db)).resolves.toBeUndefined();
  });
});
