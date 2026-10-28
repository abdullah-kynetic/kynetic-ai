import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { exportContactsCsv } from '@/server/contacts';
import type { Actor } from '@/server/auth/permissions';
import { AppError } from '@/server/errors';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let appDb: Db;
const owner: Actor = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'owner', canExport: true, canBulkDelete: false },
  viewAs: null
};
const staff: Actor = {
  ...owner,
  userId: IDS.staffA,
  membership: { tenantId: IDS.tenantA, role: 'staff', canExport: false, canBulkDelete: false }
};

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  appDb = createDb(tdb.app);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full')`;
  await tdb.admin`insert into contacts (tenant_id, first_name, last_name, primary_phone_e164, phones, emails)
    values (${IDS.tenantA}, '=HYPERLINK("https://example.test","Click")', 'Example', '+15555550991', array['+15555550991'], '{}')`;
});
afterAll(async () => {
  await tdb?.drop();
});

describe('F-38 filtered contacts export', () => {
  it('exports only the tenant view and neutralizes spreadsheet formulas, with an audit row', async () => {
    const csv = await exportContactsCsv(ctx.ownerA(), owner, { q: 'HYPERLINK' }, { db: appDb });
    expect(csv).toContain("'=HYPERLINK(");
    expect(csv).toContain(
      '"firstName","lastName","phone","email","status","source","tags","owner"'
    );
    const audit =
      await tdb.admin`select action, after from audit_log where tenant_id = ${IDS.tenantA} and action = 'contact.export'`;
    expect(audit).toHaveLength(1);
    expect(audit[0].after).toMatchObject({ rows: 1, filtered: true });
    expect(csv).not.toContain('Contact b');
  });

  it('refuses staff without export permission and refuses tenants without CRM Full', async () => {
    await expect(exportContactsCsv(ctx.staffA(), staff, {}, { db: appDb })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
    await expect(exportContactsCsv(ctx.ownerB(), owner, {}, { db: appDb })).rejects.toBeInstanceOf(
      AppError
    );
    await expect(exportContactsCsv(ctx.ownerB(), owner, {}, { db: appDb })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });
});
