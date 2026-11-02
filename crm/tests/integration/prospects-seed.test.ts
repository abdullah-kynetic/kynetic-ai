import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { PROSPECTS, seedProspectTenants } from '../../src/server/db/seed/prospects';

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db?.drop();
});

describe('real-business prospect workspaces', () => {
  it('creates 13 workspaces once and skips them on a rerun', async () => {
    const first = await seedProspectTenants(db.admin);
    expect(first).toHaveLength(13);
    expect(first.every((r) => r.status === 'created')).toBe(true);
    const second = await seedProspectTenants(db.admin);
    expect(second.every((r) => r.status === 'skipped')).toBe(true);
    const [{ n }] = await db.admin`select count(*)::int as n from tenants`;
    expect(n).toBe(13);
  });

  it('holds only business facts: no contacts, calls or leads, and no demo labels', async () => {
    for (const table of ['contacts', 'calls', 'deals', 'messages'])
      expect((await db.admin.unsafe(`select 1 from ${table}`)).length).toBe(0);
    expect(PROSPECTS.some((p) => /demo|test/i.test(p.name))).toBe(false);
    const companies = await db.admin`select name, phone_e164 from companies order by name`;
    expect(companies).toHaveLength(13);
  });
});
