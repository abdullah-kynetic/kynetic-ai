import { mkdtemp, mkdir, writeFile, cp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '../../src/server/adapters/storage/fake';
import { SIGNED_URL_TTL_S } from '../../src/server/adapters/storage';
import { getArchiveAttachmentUrl, importArchive } from '../../src/server/archive';
import { createDb, type Db } from '../../src/server/db/client';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const roadmap = fileURLToPath(new URL('../../../docs/roadmap', import.meta.url));
const staff = { userId: '11111111-1111-4111-8111-111111111111', role: 'va' as const };
let tdb: TestDatabase;
let db: Db;
let clock = new Date('2026-11-13T12:00:00Z');
const storage = new FakeStorage(() => clock);

beforeAll(async () => {
  tdb = await createTestDatabase();
  db = createDb(tdb.app);
  const dir = await mkdtemp(join(tmpdir(), 'archive-dl-'));
  await cp(roadmap, dir, { recursive: true });
  await mkdir(join(dir, 'attachments'));
  await writeFile(join(dir, 'attachments', 'search-queries.csv'), 'q\nroofing\n');
  await importArchive(tdb.admin, dir, { storage });
});
afterAll(async () => {
  await tdb?.drop();
});

const idOf = async (name: string) =>
  (await tdb.admin`select id from archive_attachments where file_name = ${name}`)[0]!.id as string;

describe('P2-4 expiring attachment download', () => {
  it('mints a link that serves the file, then stops working after the lifetime', async () => {
    const { url, fileName } = await getArchiveAttachmentUrl(
      staff,
      await idOf('search-queries.csv'),
      {
        db,
        storage
      }
    );
    expect(fileName).toBe('search-queries.csv');
    expect(new URL(url).pathname).toContain('archive/attachments/search-queries.csv');
    const served = storage.fetchSigned(url);
    expect(Buffer.from(served!.body).toString()).toBe('q\nroofing\n');
    clock = new Date(clock.getTime() + (SIGNED_URL_TTL_S - 1) * 1000);
    expect(storage.fetchSigned(url)).not.toBeNull();
    clock = new Date(clock.getTime() + 2 * 1000);
    expect(storage.fetchSigned(url)).toBeNull();
  });

  it('answers NOT_FOUND for a file not copied in, an unknown id and a bad id', async () => {
    for (const id of [
      await idOf('wave2-raw.csv'),
      '99999999-9999-4999-8999-999999999999',
      'nope'
    ]) {
      await expect(getArchiveAttachmentUrl(staff, id, { db, storage })).rejects.toMatchObject({
        code: 'NOT_FOUND'
      });
    }
  });
});
