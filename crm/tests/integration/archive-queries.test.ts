import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '../../src/server/adapters/storage/fake';
import {
  importArchive,
  listAttachments,
  listNoteTags,
  listRecords,
  searchNotes,
  searchTasks,
  getNote
} from '../../src/server/archive';
import { createDb, type Db } from '../../src/server/db/client';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const roadmap = fileURLToPath(new URL('../../../docs/roadmap', import.meta.url));
const staff = { userId: '11111111-1111-4111-8111-111111111111', role: 'admin' as const };
let tdb: TestDatabase;
let db: Db;

beforeAll(async () => {
  tdb = await createTestDatabase();
  db = createDb(tdb.app);
  await importArchive(tdb.admin, roadmap, { storage: new FakeStorage() });
});
afterAll(async () => {
  await tdb?.drop();
});

describe('P2-3 archive search', () => {
  it('finds a known note by a phrase from its body', async () => {
    // From the TCPA note body (exported 2026-11-12, kept in the 2026-11-14 trim).
    const res = await searchNotes(staff, { q: 'not reviewed by an attorney' }, { db });
    expect(res.rows.map((r) => r.title)).toContain('TCPA Consent & Opt-Out Language');
    expect(
      res.rows.find((r) => r.title === 'TCPA Consent & Opt-Out Language')?.snippet.length
    ).toBeGreaterThan(0);
  });

  it('finds an exact substring that full-text search would stem away', async () => {
    const res = await searchNotes(staff, { q: 'intent -> appointment type/resource' }, { db });
    expect(res.rows.map((r) => r.title)).toContain('BUILD PLAN 11: Scheduling');
  });

  it('matches a title, filters by tag and date, and treats % and _ as literal', async () => {
    const byTitle = await searchNotes(staff, { q: 'Client Welcome Packet' }, { db });
    expect(byTitle.rows[0]?.title).toBe('Client Welcome Packet');
    const tags = await listNoteTags(staff, { db });
    expect(tags.find((t) => t.tag === 'decision')?.count).toBeGreaterThan(0);
    const dec = await searchNotes(staff, { tag: 'decision' }, { db });
    expect(dec.rows.length).toBeGreaterThan(0);
    expect(dec.rows.every((r) => r.tag === 'decision')).toBe(true);
    const old = await searchNotes(staff, { to: '2026-09-24', from: '2026-09-24' }, { db });
    expect(old.rows.every((r) => r.createdOn === '2026-09-24')).toBe(true);
    const wild = await searchNotes(staff, { q: '%' }, { db });
    expect(wild.rows.length).toBeLessThan(48);
  });

  it('pages 25 at a time and returns the full note by id', async () => {
    const p1 = await searchNotes(staff, {}, { db });
    expect(p1.rows).toHaveLength(25);
    expect(p1.hasNext).toBe(true);
    const p2 = await searchNotes(staff, { page: 2 }, { db });
    expect(p2.rows).toHaveLength(23);
    expect(p2.hasNext).toBe(false);
    const full = await getNote(staff, p1.rows[0]!.id, { db });
    expect(full.body.length).toBeGreaterThan(0);
  });

  it('filters tasks by status, step and text', async () => {
    const done = await searchTasks(staff, { status: 'DONE' }, { db });
    expect(done.rows).toHaveLength(7);
    const step3 = await searchTasks(staff, { step: '3' }, { db });
    expect(step3.rows).toHaveLength(15);
    const hit = await searchTasks(staff, { q: 'leaked Cal.com key' }, { db });
    expect(hit.rows[0]?.title).toMatch(/Revoke the leaked Cal\.com key/);
  });

  it('lists attachments and records', async () => {
    expect(await listAttachments(staff, { db })).toHaveLength(5);
    const rec = await listRecords(staff, { object: 'people' }, { db });
    expect(rec.rows.map((r) => r.label).sort()).toEqual(['Abdullah', 'Quentin']);
  });
});
