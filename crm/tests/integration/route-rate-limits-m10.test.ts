import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { errorResponse } from '@/server/errors';
import {
  enforceApiRateLimit,
  enforceExportImportRateLimit,
  enforceSearchRateLimit
} from '@/server/security/rate-limit';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
const now = new Date('2026-10-29T12:00:10Z');

beforeAll(async () => {
  tdb = await createTestDatabase();
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

async function refusedResponse(operation: () => Promise<unknown>): Promise<Response> {
  const error = await operation().then(
    () => new Error('Expected rate limit to reject'),
    (caught: unknown) => caught
  );
  return errorResponse(error);
}

async function expectRateLimited(operation: () => Promise<unknown>) {
  const response = await refusedResponse(operation);
  expect(response.status).toBe(429);
  expect(response.headers.get('retry-after')).toBeTruthy();
  expect(await response.json()).toMatchObject({ ok: false, error: { code: 'RATE_LIMITED' } });
}

describe('M10-01 authenticated API route limits (SECURITY 5.4)', () => {
  it('returns the standard 429 after 120 API requests by one authenticated user per minute', async () => {
    for (let i = 0; i < 120; i++) await enforceApiRateLimit(db, 'synthetic-api-user', now);
    await expectRateLimited(() => enforceApiRateLimit(db, 'synthetic-api-user', now));
  });

  it('returns the standard 429 after 30 search requests by one user per minute', async () => {
    for (let i = 0; i < 30; i++) await enforceSearchRateLimit(db, 'synthetic-search-user', now);
    await expectRateLimited(() => enforceSearchRateLimit(db, 'synthetic-search-user', now));
  });

  it('shares a five-per-hour tenant budget between import and export operations', async () => {
    for (let i = 0; i < 3; i++) await enforceExportImportRateLimit(db, 'synthetic-tenant', now);
    for (let i = 0; i < 2; i++) await enforceExportImportRateLimit(db, 'synthetic-tenant', now);
    await expectRateLimited(() =>
      enforceExportImportRateLimit(db, 'synthetic-tenant', now)
    );
    await expect(enforceExportImportRateLimit(db, 'another-synthetic-tenant', now)).resolves.toMatchObject({
      allowed: true,
      count: 1
    });
  });
});
