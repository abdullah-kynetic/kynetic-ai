import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createCompany, getCompany, updateCompany } from '@/server/companies';
import { createContact, getContact, searchContacts, updateContact } from '@/server/contacts';
import { createFieldDef, listFieldDefs, type CreateFieldDefInput } from '@/server/custom-fields';
import { createDb, type Db } from '@/server/db/client';
import { createDeal, getDeal, updateDeal } from '@/server/deals';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

// P1-3: custom field values can be set, shown and filtered for a contact, a company and a deal,
// and tenant B never sees tenant A's definitions (PRD F-12).

let tdb: TestDatabase;
let opts: { db: Db };

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values
    (${IDS.tenantA}, 'crm', true, 'full'), (${IDS.tenantB}, 'crm', true, 'full')`;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const defs = [
  {
    entity: 'contact',
    key: 'roof_type',
    label: 'Roof type',
    type: 'select',
    options: ['Tile', 'Shingle'],
    filterable: true
  },
  {
    entity: 'company',
    key: 'crew_size',
    label: 'Crew size',
    type: 'number',
    filterable: true
  },
  {
    entity: 'company',
    key: 'trades',
    label: 'Trades',
    type: 'multi_select',
    options: ['Roofing', 'Siding']
  },
  { entity: 'deal', key: 'permit_cost', label: 'Permit cost', type: 'money' },
  { entity: 'deal', key: 'permit_filed', label: 'Permit filed', type: 'checkbox' },
  { entity: 'deal', key: 'inspect_on', label: 'Inspection date', type: 'date' }
] satisfies CreateFieldDefInput[];

describe('P1-3 custom field values on contact, company and deal', () => {
  it('defines fields for each kind of record', async () => {
    for (const d of defs) await createFieldDef(ctx.ownerA(), d, opts);
    const all = await listFieldDefs(ctx.ownerA(), undefined, opts);
    expect(all.map((d) => d.key)).toEqual(expect.arrayContaining(defs.map((d) => d.key)));
  });

  it('sets, shows and filters a contact value', async () => {
    const c = await createContact(
      ctx.ownerA(),
      { firstName: 'Cv', phones: ['415-555-0301'], custom: { roof_type: 'Tile' } },
      opts
    );
    await createContact(
      ctx.ownerA(),
      { firstName: 'Cv', phones: ['415-555-0302'], custom: { roof_type: 'Shingle' } },
      opts
    );
    expect((await getContact(ctx.ownerA(), c.id, opts)).custom).toEqual({ roof_type: 'Tile' });
    const rows = (
      await searchContacts(
        ctx.ownerA(),
        { q: 'Cv', custom: { roof_type: { any: ['Tile'] } } } as never,
        opts
      )
    ).rows;
    expect(rows.map((r) => r.id)).toEqual([c.id]);
    const edited = await updateContact(
      ctx.ownerA(),
      c.id,
      { custom: { roof_type: 'Shingle' } },
      opts
    );
    expect(edited.custom).toEqual({ roof_type: 'Shingle' });
  });

  it('sets, shows and edits company values and checks them by type', async () => {
    const co = await createCompany(
      ctx.ownerA(),
      { name: 'Acme Roofing', custom: { crew_size: 6, trades: ['Roofing'] } },
      opts
    );
    expect((await getCompany(ctx.ownerA(), co.id, opts)).custom).toEqual({
      crew_size: 6,
      trades: ['Roofing']
    });
    const up = await updateCompany(ctx.ownerA(), co.id, { custom: { crew_size: 9 } }, opts);
    expect(up.custom).toEqual({ crew_size: 9 });
    // An update that leaves `custom` out keeps the stored values.
    const renamed = await updateCompany(ctx.ownerA(), co.id, { name: 'Acme Roofing Co' }, opts);
    expect(renamed.custom).toEqual({ crew_size: 9 });

    for (const custom of [
      { crew_size: 'six' },
      { trades: ['Plumbing'] },
      { surprise: 1 },
      // A contact field is not a company field.
      { roof_type: 'Tile' }
    ]) {
      await expect(
        createCompany(ctx.ownerA(), { name: 'Bad', custom }, opts)
      ).rejects.toBeInstanceOf(ValidationError);
      await expect(updateCompany(ctx.ownerA(), co.id, { custom }, opts)).rejects.toBeInstanceOf(
        ValidationError
      );
    }
    expect((await getCompany(ctx.ownerA(), co.id, opts)).custom).toEqual({ crew_size: 9 });
  });

  it('sets, shows and edits deal values and checks them by type', async () => {
    const d = await createDeal(
      ctx.ownerA(),
      {
        title: 'Roof job',
        custom: { permit_cost: 125000, permit_filed: true, inspect_on: '2026-12-01' }
      },
      opts
    );
    expect((await getDeal(ctx.ownerA(), d.id, opts)).custom).toEqual({
      permit_cost: 125000,
      permit_filed: true,
      inspect_on: '2026-12-01'
    });
    const up = await updateDeal(ctx.ownerA(), d.id, { custom: { permit_cost: 99900 } }, opts);
    expect(up.custom).toEqual({ permit_cost: 99900 });
    const retitled = await updateDeal(ctx.ownerA(), d.id, { title: 'Roof job 2' }, opts);
    expect(retitled.custom).toEqual({ permit_cost: 99900 });

    for (const custom of [
      { permit_cost: 12.5 },
      { permit_filed: 'yes' },
      { inspect_on: 'soon' },
      { surprise: 1 }
    ]) {
      await expect(createDeal(ctx.ownerA(), { title: 'Bad', custom }, opts)).rejects.toBeInstanceOf(
        ValidationError
      );
      await expect(updateDeal(ctx.ownerA(), d.id, { custom }, opts)).rejects.toBeInstanceOf(
        ValidationError
      );
    }
  });

  it("tenant B never sees tenant A's definitions or values, and cannot write them", async () => {
    const seen = await listFieldDefs(ctx.ownerB(), undefined, opts);
    for (const d of defs) expect(seen.some((s) => s.key === d.key)).toBe(false);

    // A key that only tenant A defines is unknown to tenant B on every kind of record.
    await expect(
      createContact(
        ctx.ownerB(),
        { firstName: 'X', phones: ['415-555-0399'], custom: { roof_type: 'Tile' } },
        opts
      )
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createCompany(ctx.ownerB(), { name: 'X', custom: { crew_size: 3 } }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createDeal(ctx.ownerB(), { title: 'X', custom: { permit_filed: true } }, opts)
    ).rejects.toBeInstanceOf(ValidationError);

    // The same key defined by tenant B is its own definition with its own options.
    await createFieldDef(
      ctx.ownerB(),
      {
        entity: 'contact',
        key: 'roof_type',
        label: 'Roof',
        type: 'select',
        options: ['Metal']
      },
      opts
    );
    await expect(
      createContact(
        ctx.ownerB(),
        { firstName: 'Y', phones: ['415-555-0398'], custom: { roof_type: 'Tile' } },
        opts
      )
    ).rejects.toBeInstanceOf(ValidationError);
    const ok = await createContact(
      ctx.ownerB(),
      { firstName: 'Y', phones: ['415-555-0397'], custom: { roof_type: 'Metal' } },
      opts
    );
    expect(ok.custom).toEqual({ roof_type: 'Metal' });
    expect(
      (await listFieldDefs(ctx.ownerA(), 'contact', opts)).find((d) => d.key === 'roof_type')
        ?.options
    ).toEqual(['Tile', 'Shingle']);
  });
});
