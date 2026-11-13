import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { setStorage } from '@/server/adapters/storage';
import type { Actor } from '@/server/auth/permissions';
import { createDb, type Db } from '@/server/db/client';
import { commitImportBatch, createImportBatch, dryRunImportBatch } from '@/server/imports';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// KI-036: a consent date in an import file never makes an opted-out or do-not-call person reachable.
// Client and staff imports share one commit path, so both are checked.

let tdb: TestDatabase;
let db: Db;
const storage = new FakeStorage();
const ownerA: Actor = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'owner', canExport: false, canBulkDelete: false },
  viewAs: null
};
const adminActor: Actor = {
  userId: IDS.admin,
  kyneticRole: 'admin',
  membership: null,
  viewAs: null
};
const adminCtx = { tenantId: IDS.tenantA, userId: IDS.admin, role: 'admin' as const };

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

const mapping = {
  firstName: 'first',
  phone: 'phone',
  consentDate: 'agreed_on',
  consentChannel: 'agreed_via',
  consentEvidence: 'agreed_where'
};
const header = 'first,phone,agreed_on,agreed_via,agreed_where';

async function seedContact(first: string, phone: string) {
  const [row] = await tdb.admin`
    insert into contacts (tenant_id, first_name, source, phones, primary_phone_e164, emails)
    values (${IDS.tenantA}, ${first}, 'form', ${[phone]}, ${phone}, ${[]})
    returning id`;
  return row!.id as string;
}

async function runImport(rows: string[], via: 'client' | 'staff') {
  const file = new TextEncoder().encode([header, ...rows].join('\n'));
  const actor = via === 'client' ? ownerA : adminActor;
  const context = via === 'client' ? ctx.ownerA() : adminCtx;
  const batch = await createImportBatch(
    context,
    actor,
    {
      fileName: 'leads.csv',
      fileType: 'csv',
      entity: 'contact',
      importedSource: via === 'client' ? 'client_upload' : 'staff_upload',
      mapping: {},
      duplicateRule: 'skip'
    },
    file,
    { db }
  );
  await dryRunImportBatch(context, actor, batch.id, mapping, { db });
  return commitImportBatch(context, actor, batch.id, { db });
}

const consentCount = (contactId: string) =>
  tdb.admin`select count(*)::int as n from consents where contact_id = ${contactId} and kind = 'express_written'`.then(
    (r) => r[0]!.n as number
  );

describe('KI-036 import never saves consent for opted-out or do-not-call people', () => {
  for (const via of ['client', 'staff'] as const) {
    it(`${via} import: refuses consent for an opt-out, a do-not-call contact and a listed number`, async () => {
      const base = via === 'client' ? 10 : 20;
      const optedOut = await seedContact('Optout', `+1415555${base}01`);
      await tdb.admin`insert into consents (tenant_id, contact_id, channel, kind, source)
        values (${IDS.tenantA}, ${optedOut}, 'sms', 'opt_out', 'sms_keyword')`;
      const dnc = await seedContact('Dnc', `+1415555${base}02`);
      await tdb.admin`update contacts set do_not_call_at = now() where id = ${dnc}`;
      const listed = await seedContact('Listed', `+1415555${base}03`);
      await tdb.admin`insert into dnc_entries (tenant_id, e164, source)
        values (${IDS.tenantA}, ${`+1415555${base}03`}, 'staff')`;
      await tdb.admin`insert into dnc_entries (tenant_id, e164, source)
        values (${IDS.tenantA}, ${`+1415555${base}04`}, 'staff')`;
      const fresh = await seedContact('Fine', `+1415555${base}05`);

      const result = await runImport(
        [
          `Optout,415-555-${base}01,2026-10-01,sms,Web form`,
          `Dnc,415-555-${base}02,2026-10-01,sms,Web form`,
          `Listed,415-555-${base}03,2026-10-01,sms,Web form`,
          // A brand new person whose number is already on the do-not-call list.
          `Newcomer,415-555-${base}04,2026-10-01,sms,Web form`,
          `Fine,415-555-${base}05,2026-10-01,sms,Web form`
        ],
        via
      );

      expect(result).toMatchObject({ imported: 1, consents: 1, consentsRefused: 4 });
      for (const id of [optedOut, dnc, listed]) expect(await consentCount(id)).toBe(0);
      expect(await consentCount(fresh)).toBe(1);
      const [newcomer] = await tdb.admin`select id from contacts
        where first_name = 'Newcomer' and tenant_id = ${IDS.tenantA}`;
      // The person is still added to the list, only the consent is refused.
      expect(newcomer).toBeTruthy();
      expect(await consentCount(newcomer!.id)).toBe(0);
      const [audit] = await tdb.admin`select after from audit_log
        where action = 'import.commit' order by created_at desc limit 1`;
      expect(audit!.after).toMatchObject({ consentsRefused: 4 });
    });
  }
});
