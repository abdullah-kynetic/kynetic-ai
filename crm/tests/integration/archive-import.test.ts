import { mkdtemp, mkdir, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '../../src/server/adapters/storage/fake';
import { importArchive } from '../../src/server/archive';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const realRoadmap = fileURLToPath(new URL('../../../docs/roadmap', import.meta.url));
let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db?.drop();
});

async function counts() {
  const [r] = await db.admin`select
    (select count(*)::int from archive_notes) as notes, (select count(*)::int from archive_tasks) as tasks,
    (select count(*)::int from archive_attachments) as attachments, (select count(*)::int from archive_records) as records`;
  return r;
}

describe('P2-1 archive import is repeatable', () => {
  it('loads the real export and a second run leaves the same row counts', async () => {
    const storage = new FakeStorage();
    const first = await importArchive(db.admin, realRoadmap, { storage });
    expect(first).toMatchObject({ notes: 120, tasks: 63, attachments: 5 });
    expect(first.records).toBeGreaterThan(0);
    const after1 = await counts();
    const second = await importArchive(db.admin, realRoadmap, { storage });
    expect(second).toEqual(first);
    expect(await counts()).toEqual(after1);
    expect(after1).toMatchObject({ notes: 120, tasks: 63, attachments: 5 });
  });

  it('maps task statuses, steps and priorities', async () => {
    const rows =
      await db.admin`select status, count(*)::int as n from archive_tasks group by status`;
    const by = Object.fromEntries(rows.map((r) => [r.status, r.n]));
    expect(by).toEqual({ DONE: 7, IN_PROGRESS: 4, TODO: 52 });
    const [s] = await db.admin`select count(*)::int as n from archive_tasks where step = 2`;
    expect(s.n).toBe(15);
  });

  it('attaches a file found later without duplicating the row', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'archive-'));
    await cp(realRoadmap, dir, { recursive: true });
    await mkdir(join(dir, 'attachments'));
    await writeFile(join(dir, 'attachments', 'search-queries.csv'), 'q\nroofing\n');
    const storage = new FakeStorage();
    const r = await importArchive(db.admin, dir, { storage });
    expect(r.attachmentFilesUploaded).toBe(1);
    const [a] =
      await db.admin`select file_key, size_bytes from archive_attachments where file_name = 'search-queries.csv'`;
    expect(a.file_key).toBe('archive/attachments/search-queries.csv');
    expect(Number(a.size_bytes)).toBe(10);
    expect((await counts()).attachments).toBe(5);
    // A later run without the file keeps the key.
    await importArchive(db.admin, realRoadmap, { storage });
    const [b] =
      await db.admin`select file_key from archive_attachments where file_name = 'search-queries.csv'`;
    expect(b.file_key).toBe('archive/attachments/search-queries.csv');
  });
});
