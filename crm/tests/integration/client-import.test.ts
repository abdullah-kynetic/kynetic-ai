import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { setStorage } from '@/server/adapters/storage';
import type { Actor } from '@/server/auth/permissions';
import { searchContacts } from '@/server/contacts';
import { createDb, type Db } from '@/server/db/client';
import {
  commitImportBatch,
  createImportBatch,
  dryRunImportBatch,
  listImportBatches,
  undoImportBatch
} from '@/server/imports';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { buildXlsx, sheetWithRows } from '../helpers/xlsx-fixture';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// P1-5: a client's owner imports their own contact list with a dry run and the consent rules, and
// sees only their own tenant's rows.

let tdb: TestDatabase;
let db: Db;
const storage = new FakeStorage();

const tenantActor = (userId: string, tenantId: string, role: 'owner' | 'staff'): Actor => ({
  userId,
  kyneticRole: null,
  membership: { tenantId, role, canExport: false, canBulkDelete: false },
  viewAs: null
});
const ownerA = tenantActor(IDS.ownerA, IDS.tenantA, 'owner');
const staffA = tenantActor(IDS.staffA, IDS.tenantA, 'staff');

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  setStorage(storage);
});
afterAll(async () => {
  setStorage(undefined);
  await tdb?.drop();
});

const csv = [
  'first,last,phone,email,agreed_on,agreed_via,agreed_where',
  'Dana,Client,415-555-0701,dana@example.test,2026-10-01,sms,Web form 10/1',
  'Dana,Again,415-555-0701,,,,',
  'Bad,Phone,not-a-phone,,,,',
  'Eli,Client,415-555-0702,,2026-10-01,sms,'
].join('\n');
const mapping = {
  firstName: 'first',
  lastName: 'last',
  phone: 'phone',
  email: 'email',
  consentDate: 'agreed_on',
  consentChannel: 'agreed_via',
  consentEvidence: 'agreed_where'
};
const intake = (file: Uint8Array, name: string, fileType: 'csv' | 'xlsx') => ({
  fileName: name,
  fileType,
  entity: 'contact' as const,
  importedSource: 'client_upload',
  mapping: {},
  duplicateRule: 'skip' as const
});

describe('P1-5 client self-serve lead import', () => {
  it('uploads a CSV, shows a dry run, imports, and keeps rows in the client tenant', async () => {
    const file = new TextEncoder().encode(csv);
    const batch = await createImportBatch(
      ctx.ownerA(),
      ownerA,
      intake(file, 'leads.csv', 'csv'),
      file,
      { db }
    );
    const before =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`;

    const report = await dryRunImportBatch(ctx.ownerA(), ownerA, batch.id, mapping, { db });
    // Duplicates and invalid phones are reported, with the row number (the header is row 1).
    expect(report).toMatchObject({ total: 4, ok: 2, duplicates: 1, failed: 1 });
    expect(report.issues).toEqual([expect.objectContaining({ row: 4 })]);
    // The dry run writes no contacts.
    const afterDryRun =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`;
    expect(afterDryRun[0]!.n).toBe(before[0]!.n);

    const result = await commitImportBatch(ctx.ownerA(), ownerA, batch.id, { db });
    expect(result).toMatchObject({ imported: 2, failed: 1 });

    const rows = await tdb.admin`select first_name, imported_source, import_batch_id, tenant_id
      from contacts where import_batch_id = ${batch.id} order by first_name`;
    expect(rows.map((r) => r.first_name)).toEqual(['Dana', 'Eli']);
    expect(
      rows.every((r) => r.tenant_id === IDS.tenantA && r.imported_source === 'client_upload')
    ).toBe(true);

    // Consent follows the staff import rules: saved only for a row with a date, a channel and proof.
    const consents = await tdb.admin`select c.first_name, k.channel, k.source
      from consents k join contacts c on c.id = k.contact_id where c.import_batch_id = ${batch.id}`;
    expect(consents).toEqual([
      expect.objectContaining({ first_name: 'Dana', channel: 'sms', source: 'import' })
    ]);

    // Tenant B sees none of it.
    expect(
      (await searchContacts(ctx.ownerB(), { q: 'Dana' }, { db })).rows.map((r) => r.firstName)
    ).toEqual([]);
    const inB =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantB} and import_batch_id = ${batch.id}`;
    expect(inB[0]!.n).toBe(0);
    // The history shows the owner's own batches.
    expect((await listImportBatches(ctx.ownerA(), ownerA, { db })).map((b) => b.id)).toContain(
      batch.id
    );

    // The owner can undo their own import.
    const undone = await undoImportBatch(ctx.ownerA(), ownerA, batch.id, { db });
    expect(undone).toMatchObject({ removed: expect.any(Number) });
    const left =
      await tdb.admin`select count(*)::int as n from contacts where import_batch_id = ${batch.id} and deleted_at is null`;
    expect(left[0]!.n).toBe(0);
  });

  it('reads an Excel .xlsx file the same way', async () => {
    const file = buildXlsx(
      sheetWithRows([
        ['first', 'phone'],
        ['Xena', '415-555-0711'],
        ['Xavier', '415-555-0712']
      ])
    );
    const batch = await createImportBatch(
      ctx.ownerA(),
      ownerA,
      intake(file, 'leads.xlsx', 'xlsx'),
      file,
      { db }
    );
    const report = await dryRunImportBatch(
      ctx.ownerA(),
      ownerA,
      batch.id,
      { firstName: 'first', phone: 'phone' },
      { db }
    );
    expect(report).toMatchObject({ total: 2, ok: 2, failed: 0 });
    expect(await commitImportBatch(ctx.ownerA(), ownerA, batch.id, { db })).toMatchObject({
      imported: 2
    });
  });

  it('refuses a bad file type and a client staff user', async () => {
    const file = new TextEncoder().encode('phone\n4155550199');
    await expect(
      createImportBatch(ctx.ownerA(), ownerA, intake(file, 'leads.xls', 'csv'), file, { db })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      createImportBatch(ctx.staffA(), staffA, intake(file, 'leads.csv', 'csv'), file, { db })
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('keeps companies, deals and notes with Kynetic staff', async () => {
    const file = new TextEncoder().encode('name\nAcme');
    await expect(
      createImportBatch(
        ctx.ownerA(),
        ownerA,
        { ...intake(file, 'co.csv', 'csv'), entity: 'company' },
        file,
        { db }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
