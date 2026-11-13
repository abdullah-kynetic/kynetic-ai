import { fileURLToPath } from 'node:url';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '../../src/server/adapters/storage/fake';
import {
  getArchiveAttachmentUrl,
  getNote,
  importArchive,
  listAttachments,
  listRecords,
  searchNotes,
  searchTasks
} from '../../src/server/archive';
import { createDb, type Db } from '../../src/server/db/client';
import { withTenant } from '../../src/server/tenancy';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const roadmap = fileURLToPath(new URL('../../../docs/roadmap', import.meta.url));
let tdb: TestDatabase;
let db: Db;
const TABLES = ['archive_notes', 'archive_tasks', 'archive_attachments', 'archive_records'];

beforeAll(async () => {
  tdb = await createTestDatabase();
  db = createDb(tdb.app);
  await seedTwoTenants(tdb.admin);
  await importArchive(tdb.admin, roadmap, { storage: new FakeStorage() });
});
afterAll(async () => {
  await tdb?.drop();
});

describe('P2-2 clients and anonymous requests cannot read the archive', () => {
  it('a client user in their own tenant sees zero rows in every archive table', async () => {
    for (const role of ['owner', 'staff'] as const) {
      for (const t of TABLES) {
        const n = await withTenant(
          { tenantId: IDS.tenantA, userId: IDS.ownerA, role },
          async (tx) => {
            const rows = await tx.execute(sql.raw(`select 1 from ${t}`));
            return Array.from(rows).length;
          },
          { db }
        );
        expect(n, `${role} ${t}`).toBe(0);
      }
    }
  });

  it('a connection with no session context sees zero rows and cannot write', async () => {
    for (const t of TABLES) {
      expect((await tdb.app.unsafe(`select 1 from ${t}`)).length, t).toBe(0);
      await expect(
        tdb.app.unsafe(`insert into ${t} select * from ${t} limit 1`)
      ).rejects.toBeTruthy();
      await expect(tdb.app.unsafe(`delete from ${t}`)).rejects.toThrow(/permission denied/);
      await expect(tdb.worker.unsafe(`select 1 from ${t}`)).rejects.toThrow(/permission denied/);
    }
  });

  it('every archive query and the download refuse a client role before touching the database', async () => {
    const client = { userId: IDS.ownerA, role: 'owner' } as never;
    const id = '99999999-9999-4999-8999-999999999999';
    await expect(searchNotes(client, {}, { db })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(searchTasks(client, {}, { db })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(listAttachments(client, { db })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(listRecords(client, {}, { db })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(getNote(client, id, { db })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(getArchiveAttachmentUrl(client, id, { db })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('a staff session that also carries a tenant context reads nothing', async () => {
    const n = await db.transaction(async (tx) => {
      await tx.execute(
        sql.raw(
          `select set_config('app.role','admin',true), set_config('app.tenant_id','${IDS.tenantA}',true)`
        )
      );
      return Array.from(await tx.execute(sql.raw('select 1 from archive_notes'))).length;
    });
    expect(n).toBe(0);
  });
});
