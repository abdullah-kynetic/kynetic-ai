import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { setStorage } from '@/server/adapters/storage';
import type { Actor } from '@/server/auth/permissions';
import { createDb, type Db } from '@/server/db/client';
import {
  createImportBatch,
  dryRunContactBatch,
  commitContactBatch,
  undoImportBatch,
  listImportBatches
} from '@/server/imports';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { IMPORT_MAX_BYTES } from '@/server/imports';

let tdb: TestDatabase;
let appDb: Db;
const storage = new FakeStorage();
const adminActor: Actor = {
  userId: IDS.admin,
  kyneticRole: 'admin',
  membership: null,
  viewAs: null
};
const adminCtx = { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' as const };
const ownerActor: Actor = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'owner', canExport: false, canBulkDelete: false },
  viewAs: null
};

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  appDb = createDb(tdb.app);
  setStorage(storage);
});
afterAll(async () => {
  setStorage(undefined);
  await tdb?.drop();
});

describe('F-90 to F-96 contact import workflow', () => {
  it('keeps dry-run read-only, commits synthetic contacts without outreach, and undoes safely', async () => {
    const file = new TextEncoder().encode(
      'first,last,phone,email,external\nAda,Import,(415) 555-0198,ada-import@example.test,ext-1\nBad,Row,123,x@example.test,ext-2'
    );
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      {
        fileName: 'contacts.csv',
        fileType: 'csv',
        importedSource: 'csv_other',
        mapping: {},
        duplicateRule: 'skip'
      },
      file,
      { db: appDb }
    );
    const before =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`;
    const report = await dryRunContactBatch(
      adminCtx,
      adminActor,
      batch.id,
      {
        firstName: 'first',
        lastName: 'last',
        phone: 'phone',
        email: 'email',
        externalId: 'external'
      },
      { db: appDb }
    );
    expect(report).toMatchObject({ total: 2, ok: 1, failed: 1 });
    const afterDryRun =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`;
    expect(afterDryRun[0]!.n).toBe(before[0]!.n);
    expect(
      await dryRunContactBatch(ctx.ownerA(), ownerActor, batch.id, {}, { db: appDb }).catch(
        (e) => e.code
      )
    ).toBe('FORBIDDEN');

    const committed = await commitContactBatch(adminCtx, adminActor, batch.id, {
      db: appDb
    });
    expect(committed).toMatchObject({ imported: 1, failed: 1 });
    const imported =
      await tdb.admin`select id, primary_phone_e164, imported_source, import_batch_id, external_id from contacts where tenant_id = ${IDS.tenantA} and external_id = 'ext-1'`;
    expect(imported).toHaveLength(1);
    expect(imported[0]).toMatchObject({
      primary_phone_e164: '+14155550198',
      imported_source: 'csv_other',
      import_batch_id: batch.id,
      external_id: 'ext-1'
    });
    expect(
      await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantB} and external_id = 'ext-1'`
    ).toHaveLength(0);
    expect(
      await tdb.admin`select id from webhook_events where tenant_id = ${IDS.tenantA} and payload->>'name' = 'lead.created'`
    ).toHaveLength(0);
    const commitAudit = await tdb.admin`select actor_user_id from audit_log where tenant_id = ${IDS.tenantA} and action = 'import.commit' and entity_id = ${batch.id}`;
    expect(commitAudit).toHaveLength(1);
    expect(commitAudit[0]!.actor_user_id).toBe(IDS.admin);

    const undone = await undoImportBatch(adminCtx, adminActor, batch.id, { db: appDb });
    expect(undone).toMatchObject({ removed: 1, skipped: [] });
    expect(
      await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantA} and external_id = 'ext-1' and deleted_at is null`
    ).toHaveLength(0);
    expect(
      (await listImportBatches(adminCtx, adminActor, { db: appDb })).find(
        (row) => row.id === batch.id
      )?.status
    ).toBe('undone');
  });

  it('refuses unsafe spreadsheets and owner-only import attempts', async () => {
    await expect(
      createImportBatch(
        adminCtx,
        adminActor,
        {
          fileName: 'contacts.xlsx',
          fileType: 'xlsx',
          importedSource: 'csv_other'
        },
        new Uint8Array([0x50, 0x4b]),
        { db: appDb }
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      createImportBatch(
        ctx.ownerA(),
        ownerActor,
        {
          fileName: 'contacts.csv',
          fileType: 'csv',
          importedSource: 'csv_other'
        },
        new TextEncoder().encode('phone\n4155550199'),
        { db: appDb }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('rejects oversized, renamed-binary, malformed and over-limit CSV before storage writes', async () => {
    const before = (await storage.list(`${IDS.tenantA}/imports/`)).length;
    const base = { fileName: 'intake.csv', fileType: 'csv' as const, importedSource: 'synthetic' };
    await expect(createImportBatch(adminCtx, adminActor, base, new Uint8Array(IMPORT_MAX_BYTES + 1), { db: appDb })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(createImportBatch(adminCtx, adminActor, base, new Uint8Array([0, 1, 2]), { db: appDb })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(createImportBatch(adminCtx, adminActor, base, new TextEncoder().encode('name\n"broken'), { db: appDb })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(createImportBatch(adminCtx, adminActor, base, new TextEncoder().encode(`name\n${'Ada\n'.repeat(50_001)}`), { db: appDb })).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await storage.list(`${IDS.tenantA}/imports/`)).toHaveLength(before);
  });

  it('normalizes phone duplicates and refuses commit without a matching dry run', async () => {
    const file = new TextEncoder().encode('first,phone\nNew,(415) 555-0198\nNew,+14155550198');
    const batch = await createImportBatch(adminCtx, adminActor, { fileName: 'duplicates.csv', fileType: 'csv', importedSource: 'synthetic' }, file, { db: appDb });
    await expect(commitContactBatch(adminCtx, adminActor, batch.id, { db: appDb })).rejects.toMatchObject({ code: 'CONFLICT' });
    const preview = await dryRunContactBatch(adminCtx, adminActor, batch.id, { firstName: 'first', phone: 'phone' }, { db: appDb });
    expect(preview).toMatchObject({ total: 2, ok: 1, duplicates: 1, failed: 0 });
  });
});
