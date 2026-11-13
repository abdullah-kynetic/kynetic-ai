import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { setStorage } from '@/server/adapters/storage';
import type { Actor } from '@/server/auth/permissions';
import { createDb, type Db } from '@/server/db/client';
import {
  createImportBatch,
  dryRunContactBatch,
  commitContactBatch,
  dryRunImportBatch,
  commitImportBatch,
  commitEntityBatch,
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
// A client's staff user: only the owner may import (`import.self`), so staff are refused (P1-5).
const staffActor: Actor = {
  userId: IDS.staffA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'staff', canExport: false, canBulkDelete: false },
  viewAs: null
};
const vaActor: Actor = { userId: IDS.va, kyneticRole: 'va', membership: null, viewAs: null };

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
    expect(
      await tdb.admin`select mapping from import_batches where id = ${batch.id}`
    ).toMatchObject([
      {
        mapping: {
          firstName: 'first',
          lastName: 'last',
          phone: 'phone',
          email: 'email',
          externalId: 'external'
        }
      }
    ]);
    const afterDryRun =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`;
    expect(afterDryRun[0]!.n).toBe(before[0]!.n);
    expect(
      await dryRunContactBatch(ctx.ownerA(), staffActor, batch.id, {}, { db: appDb }).catch(
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
    const commitAudit =
      await tdb.admin`select actor_user_id from audit_log where tenant_id = ${IDS.tenantA} and action = 'import.commit' and entity_id = ${batch.id}`;
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
    const storedBefore = (await storage.list(`${IDS.tenantA}/imports/`)).length;
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
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { file: ['not_zip'] }
    });
    await expect(
      createImportBatch(
        adminCtx,
        adminActor,
        { fileName: 'active.xlsm', fileType: 'xlsx', importedSource: 'csv_other' },
        new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00]),
        { db: appDb }
      )
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
      fieldErrors: { file: ['unsupported_type'] }
    });
    expect(await storage.list(`${IDS.tenantA}/imports/`)).toHaveLength(storedBefore);
    await expect(
      createImportBatch(
        ctx.ownerA(),
        staffActor,
        {
          fileName: 'contacts.csv',
          fileType: 'csv',
          importedSource: 'csv_other'
        },
        new TextEncoder().encode('phone\n4155550199'),
        { db: appDb }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    // An owner imports contacts only (P1-5); companies, deals and notes stay with Kynetic staff.
    await expect(
      createImportBatch(
        ctx.ownerA(),
        ownerActor,
        {
          fileName: 'companies.csv',
          fileType: 'csv',
          entity: 'company',
          importedSource: 'csv_other'
        },
        new TextEncoder().encode('name\nAcme'),
        { db: appDb }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    await expect(
      createImportBatch(
        adminCtx,
        vaActor,
        { fileName: 'va.csv', fileType: 'csv', importedSource: 'synthetic' },
        new TextEncoder().encode('phone\n4155550199'),
        { db: appDb }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('reports 50 invalid rows and 30 E.164 duplicates in a 1,000-row dry run without writes', async () => {
    const rows = ['first,phone'];
    for (let i = 0; i < 920; i++) rows.push(`Synthetic ${i},415555${String(1000 + i).slice(-4)}`);
    for (let i = 0; i < 30; i++) rows.push(`Duplicate ${i},+1415555${String(1000 + i).slice(-4)}`);
    for (let i = 0; i < 50; i++) rows.push(`Invalid ${i},not-a-phone`);
    expect(rows).toHaveLength(1001);
    const before =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`;
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      { fileName: 'one-thousand.csv', fileType: 'csv', importedSource: 'synthetic-1000' },
      new TextEncoder().encode(rows.join('\n')),
      { db: appDb }
    );
    const report = await dryRunContactBatch(
      adminCtx,
      adminActor,
      batch.id,
      { firstName: 'first', phone: 'phone' },
      { db: appDb }
    );
    expect(report).toMatchObject({ total: 1000, ok: 920, failed: 50, duplicates: 30 });
    expect(report.issues).toHaveLength(50);
    expect(
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`
    ).toEqual(before);
  });

  it('runs a 50,000-row contact dry-run without writing contacts', async () => {
    const rows = ['first,email'];
    for (let i = 0; i < 50_000; i++)
      rows.push(`Synthetic ${i},bulk-${String(i).padStart(5, '0')}@example.test`);
    const before =
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`;
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      { fileName: 'fifty-thousand.csv', fileType: 'csv', importedSource: 'synthetic-50000' },
      new TextEncoder().encode(rows.join('\n')),
      { db: appDb }
    );
    const report = await dryRunContactBatch(
      adminCtx,
      adminActor,
      batch.id,
      { firstName: 'first', email: 'email' },
      { db: appDb }
    );
    expect(report).toMatchObject({ total: 50_000, ok: 50_000, failed: 0, duplicates: 0 });
    expect(
      await tdb.admin`select count(*)::int as n from contacts where tenant_id = ${IDS.tenantA}`
    ).toEqual(before);
  }, 60_000);

  it('rejects oversized, renamed-binary, malformed and over-limit CSV before storage writes', async () => {
    const before = (await storage.list(`${IDS.tenantA}/imports/`)).length;
    const base = { fileName: 'intake.csv', fileType: 'csv' as const, importedSource: 'synthetic' };
    await expect(
      createImportBatch(adminCtx, adminActor, base, new Uint8Array(IMPORT_MAX_BYTES + 1), {
        db: appDb
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      createImportBatch(adminCtx, adminActor, base, new Uint8Array([0, 1, 2]), { db: appDb })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      createImportBatch(adminCtx, adminActor, base, new TextEncoder().encode('name\n"broken'), {
        db: appDb
      })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      createImportBatch(
        adminCtx,
        adminActor,
        base,
        new TextEncoder().encode(`name\n${'Ada\n'.repeat(50_001)}`),
        { db: appDb }
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(await storage.list(`${IDS.tenantA}/imports/`)).toHaveLength(before);
  });

  it('normalizes phone duplicates and refuses commit without a matching dry run', async () => {
    const file = new TextEncoder().encode('first,phone\nNew,(415) 555-0198\nNew,+14155550198');
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      { fileName: 'duplicates.csv', fileType: 'csv', importedSource: 'synthetic' },
      file,
      { db: appDb }
    );
    await expect(
      commitContactBatch(adminCtx, adminActor, batch.id, { db: appDb })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const preview = await dryRunContactBatch(
      adminCtx,
      adminActor,
      batch.id,
      { firstName: 'first', phone: 'phone' },
      { db: appDb }
    );
    expect(preview).toMatchObject({ total: 2, ok: 1, duplicates: 1, failed: 0 });
  });

  it('matches duplicate email addresses case-insensitively', async () => {
    await tdb.admin`insert into contacts (tenant_id, first_name, emails, primary_email)
      values (${IDS.tenantA}, 'Existing synthetic email', ARRAY['mixedcase@example.test'], 'mixedcase@example.test')`;
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      {
        fileName: 'email-duplicates.csv',
        fileType: 'csv',
        importedSource: 'synthetic-email-dedupe'
      },
      new TextEncoder().encode('first,email\nNew, mixedcase@EXAMPLE.test'),
      { db: appDb }
    );
    await expect(
      dryRunContactBatch(
        adminCtx,
        adminActor,
        batch.id,
        { firstName: 'first', email: 'email' },
        { db: appDb }
      )
    ).resolves.toMatchObject({ total: 1, ok: 0, duplicates: 1, failed: 0 });
  });

  it('lists an imported contact edited after commit and leaves it intact on undo', async () => {
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      { fileName: 'edited.csv', fileType: 'csv', importedSource: 'synthetic-edited' },
      new TextEncoder().encode('first,phone,external\nBefore,4155550177,edited-1'),
      { db: appDb }
    );
    await dryRunContactBatch(
      adminCtx,
      adminActor,
      batch.id,
      { firstName: 'first', phone: 'phone', externalId: 'external' },
      { db: appDb }
    );
    await commitContactBatch(adminCtx, adminActor, batch.id, { db: appDb });
    const [imported] =
      await tdb.admin`select id from contacts where tenant_id = ${IDS.tenantA} and external_id = 'edited-1'`;
    await tdb.admin`update contacts set first_name = 'Edited by owner', updated_at =
      (select committed_at + interval '1 second' from import_batches where id = ${batch.id})
      where id = ${imported!.id}`;

    const result = await undoImportBatch(adminCtx, adminActor, batch.id, { db: appDb });
    expect(result).toMatchObject({ removed: 0, skipped: [imported!.id] });
    expect(
      await tdb.admin`select first_name, deleted_at from contacts where id = ${imported!.id}`
    ).toMatchObject([{ first_name: 'Edited by owner', deleted_at: null }]);
  });

  it('fills only empty duplicate fields and restores them on undo', async () => {
    const [existing] =
      await tdb.admin`insert into contacts (tenant_id, first_name, phones, emails, primary_phone_e164, imported_source)
      values (${IDS.tenantA}, '', ARRAY['+14155550166'], ARRAY[]::text[], '+14155550166', 'synthetic-existing') returning id`;
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      {
        fileName: 'fill-empty.csv',
        fileType: 'csv',
        importedSource: 'synthetic-fill',
        duplicateRule: 'fill_empty'
      },
      new TextEncoder().encode('first,phone\nKeep safe,4155550166'),
      { db: appDb }
    );
    await dryRunContactBatch(
      adminCtx,
      adminActor,
      batch.id,
      { firstName: 'first', phone: 'phone' },
      { db: appDb }
    );
    await expect(
      commitContactBatch(adminCtx, adminActor, batch.id, { db: appDb })
    ).resolves.toMatchObject({ imported: 0, filled: 1, skipped: 1, failed: 0 });
    expect(await tdb.admin`select first_name from contacts where id = ${existing!.id}`).toEqual([
      { first_name: 'Keep safe' }
    ]);
    await expect(
      undoImportBatch(adminCtx, adminActor, batch.id, { db: appDb })
    ).resolves.toMatchObject({ removed: 0, restored: 1, skipped: [] });
    expect(await tdb.admin`select first_name from contacts where id = ${existing!.id}`).toEqual([
      { first_name: '' }
    ]);
  });

  it('imports only evidenced consent and revokes it when the batch is undone', async () => {
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      { fileName: 'consent.csv', fileType: 'csv', importedSource: 'synthetic-consent' },
      new TextEncoder().encode(
        'first,phone,channel,date,evidence\nConsented,4155550133,sms,2026-10-01,Synthetic web form\nNo evidence,4155550134,sms,,\nBad channel,4155550135,other,2026-10-01,Synthetic evidence'
      ),
      { db: appDb }
    );
    const mapping = {
      firstName: 'first',
      phone: 'phone',
      consentChannel: 'channel',
      consentDate: 'date',
      consentEvidence: 'evidence'
    };
    await expect(
      dryRunContactBatch(adminCtx, adminActor, batch.id, mapping, { db: appDb })
    ).resolves.toMatchObject({ total: 3, ok: 3, failed: 0 });
    await expect(
      commitContactBatch(adminCtx, adminActor, batch.id, { db: appDb })
    ).resolves.toMatchObject({ imported: 3, consents: 1, failed: 0 });
    const consented =
      await tdb.admin`select c.first_name, co.source, co.captured_text, co.revoked_at from consents co join contacts c on c.id = co.contact_id where co.tenant_id = ${IDS.tenantA} and c.imported_source = 'synthetic-consent'`;
    expect(consented).toEqual([
      {
        first_name: 'Consented',
        source: 'import',
        captured_text: 'Synthetic web form',
        revoked_at: null
      }
    ]);
    await expect(
      undoImportBatch(adminCtx, adminActor, batch.id, { db: appDb })
    ).resolves.toMatchObject({ removed: 3, restored: 1, skipped: [] });
    const consentLedger =
      await tdb.admin`select kind, source from consents where tenant_id = ${IDS.tenantA} and contact_id = (select id from contacts where tenant_id = ${IDS.tenantA} and imported_source = 'synthetic-consent' and first_name = 'Consented') order by created_at`;
    expect(consentLedger).toEqual([
      { kind: 'express_written', source: 'import' },
      { kind: 'opt_out', source: 'staff' }
    ]);
  });

  it('imports synthetic companies, deals and linked notes with traceable batch metadata and undo', async () => {
    const asyncImport = async (
      entity: 'company' | 'deal' | 'note',
      fileName: string,
      csv: string,
      mapping: Record<string, string>
    ) => {
      const batch = await createImportBatch(
        adminCtx,
        adminActor,
        { fileName, fileType: 'csv', entity, importedSource: 'synthetic-multi' },
        new TextEncoder().encode(csv),
        { db: appDb }
      );
      const preview = await dryRunImportBatch(adminCtx, adminActor, batch.id, mapping, {
        db: appDb
      });
      expect(preview).toMatchObject({ total: 1, ok: 1, failed: 0 });
      const result = await commitImportBatch(adminCtx, adminActor, batch.id, { db: appDb });
      expect(result).toMatchObject({ imported: 1, failed: 0 });
      return batch.id;
    };

    const companyBatch = await asyncImport(
      'company',
      'companies.csv',
      'business,phone,site,external\nSynthetic Co,4155550144,https://example.test,co-1',
      { name: 'business', phone: 'phone', website: 'site', externalId: 'external' }
    );
    const dealBatch = await asyncImport(
      'deal',
      'deals.csv',
      'quote,value,stage,external\nSynthetic quote,123450,New,d-1',
      { title: 'quote', valueCents: 'value', stage: 'stage', externalId: 'external' }
    );
    const noteBatch = await asyncImport(
      'note',
      'notes.csv',
      'history,parent,external\nSynthetic imported history,d-1,n-1',
      { body: 'history', dealExternalId: 'parent', externalId: 'external' }
    );

    const [company] =
      await tdb.admin`select id, imported_source, import_batch_id, external_id from companies where tenant_id = ${IDS.tenantA} and external_id = 'co-1'`;
    const [deal] =
      await tdb.admin`select id, value_cents, imported_source, import_batch_id, external_id from deals where tenant_id = ${IDS.tenantA} and external_id = 'd-1'`;
    const [note] =
      await tdb.admin`select id, body_text, deal_id, imported_source, import_batch_id, external_id from notes where tenant_id = ${IDS.tenantA} and external_id = 'n-1'`;
    expect(company).toMatchObject({
      imported_source: 'synthetic-multi',
      import_batch_id: companyBatch,
      external_id: 'co-1'
    });
    expect(deal).toMatchObject({
      value_cents: 123450,
      imported_source: 'synthetic-multi',
      import_batch_id: dealBatch,
      external_id: 'd-1'
    });
    expect(
      await tdb.admin`select s.name from deals d join pipeline_stages s on s.id = d.stage_id where d.id = ${deal!.id}`
    ).toEqual([{ name: 'New' }]);
    expect(note).toMatchObject({
      body_text: 'Synthetic imported history',
      deal_id: deal!.id,
      imported_source: 'synthetic-multi',
      import_batch_id: noteBatch,
      external_id: 'n-1'
    });

    expect(await undoImportBatch(adminCtx, adminActor, companyBatch, { db: appDb })).toMatchObject({
      removed: 1
    });
    expect(await undoImportBatch(adminCtx, adminActor, dealBatch, { db: appDb })).toMatchObject({
      removed: 1
    });
    expect(await undoImportBatch(adminCtx, adminActor, noteBatch, { db: appDb })).toMatchObject({
      removed: 1
    });
    expect(await tdb.admin`select deleted_at from companies where id = ${company!.id}`).not.toEqual(
      [{ deleted_at: null }]
    );
    expect(await tdb.admin`select deleted_at from deals where id = ${deal!.id}`).not.toEqual([
      { deleted_at: null }
    ]);
    expect(await tdb.admin`select deleted_at from notes where id = ${note!.id}`).not.toEqual([
      { deleted_at: null }
    ]);
  });

  it('marks an interrupted entity batch failed and leaves completed rows listed and undoable', async () => {
    const batch = await createImportBatch(
      adminCtx,
      adminActor,
      {
        fileName: 'partial-companies.csv',
        fileType: 'csv',
        entity: 'company',
        importedSource: 'synthetic-partial'
      },
      new TextEncoder().encode('name,external\nWritten Co,p-1\nNot reached Co,p-2'),
      { db: appDb }
    );
    await dryRunImportBatch(
      adminCtx,
      adminActor,
      batch.id,
      { name: 'name', externalId: 'external' },
      { db: appDb }
    );
    const result = await commitEntityBatch(adminCtx, adminActor, batch.id, {
      db: appDb,
      afterEntityRow: (imported) => {
        if (imported === 1) throw new Error('synthetic worker interruption');
      }
    });
    expect(result).toMatchObject({ imported: 1 });
    expect(await tdb.admin`select status from import_batches where id = ${batch.id}`).toEqual([
      { status: 'failed' }
    ]);
    expect(
      await tdb.admin`select record_id from import_batch_records where batch_id = ${batch.id}`
    ).toHaveLength(1);
    expect(await undoImportBatch(adminCtx, adminActor, batch.id, { db: appDb })).toMatchObject({
      removed: 1,
      skipped: []
    });
  });
});
