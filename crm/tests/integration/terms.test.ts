import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { CURRENT_DOCUMENTS, pendingDocuments, recordAcceptance } from '@/server/terms';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

const v2 = CURRENT_DOCUMENTS.map((d) => ({ ...d, version: `${d.version}-v2` }));

describe('F-102 terms acceptance', () => {
  it('a user who has not accepted has both documents pending', async () => {
    const pending = await pendingDocuments(IDS.ownerA, { db });
    expect(pending.map((d) => d.document).toSorted()).toEqual(['privacy', 'terms']);
  });

  it('accepting records version, time and IP, and clears the pending list', async () => {
    await recordAcceptance(IDS.ownerA, '203.0.113.7', { db });
    expect(await pendingDocuments(IDS.ownerA, { db })).toEqual([]);
    const rows = await tdb.admin`select document, version, host(ip) as ip, accepted_at
      from terms_acceptances where user_id = ${IDS.ownerA} order by document`;
    expect(rows.map((r) => [r.document, r.version, r.ip])).toEqual(
      CURRENT_DOCUMENTS.map((d) => [d.document, d.version, '203.0.113.7']).toSorted()
    );
    expect(rows.every((r) => r.accepted_at instanceof Date)).toBe(true);
  });

  it('is not asked again, and accepting twice adds no rows', async () => {
    await recordAcceptance(IDS.ownerA, null, { db });
    const [{ n }] = await tdb.admin`select count(*)::int as n from terms_acceptances
      where user_id = ${IDS.ownerA}`;
    expect(n).toBe(CURRENT_DOCUMENTS.length);
    expect(await pendingDocuments(IDS.ownerA, { db })).toEqual([]);
  });

  it("another user's acceptance does not count", async () => {
    expect(await pendingDocuments(IDS.staffA, { db })).toHaveLength(CURRENT_DOCUMENTS.length);
  });

  it('a new version is asked for again and the old rows stay', async () => {
    expect(await pendingDocuments(IDS.ownerA, { db, documents: v2 })).toHaveLength(v2.length);
    await recordAcceptance(IDS.ownerA, null, { db, documents: v2 });
    expect(await pendingDocuments(IDS.ownerA, { db, documents: v2 })).toEqual([]);
    const [{ n }] = await tdb.admin`select count(*)::int as n from terms_acceptances
      where user_id = ${IDS.ownerA}`;
    expect(n).toBe(CURRENT_DOCUMENTS.length + v2.length);
  });

  it('the app role cannot edit or delete an acceptance, or record one for someone else', async () => {
    await expect(
      tdb.app`update terms_acceptances set version = 'x' where user_id = ${IDS.ownerA}`
    ).rejects.toThrow();
    await expect(tdb.app`delete from terms_acceptances`).rejects.toThrow();
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`select set_config('app.user_id', ${IDS.staffA}, true)`);
        await tx.execute(
          sql`insert into terms_acceptances (user_id, document, version)
            values (${IDS.ownerA}, 'terms', 'forged')`
        );
      })
    ).rejects.toThrow();
  });
});
