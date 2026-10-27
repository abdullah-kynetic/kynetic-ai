import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  createCompany,
  deleteCompany,
  getCompany,
  getCompanyDetail,
  listCompanies,
  updateCompany
} from '@/server/companies';
import { createContact, NotFoundError, updateContact } from '@/server/contacts';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { ModuleDisabledError } from '@/server/modules';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let opts: { db: Db };
let a: SeededTenant;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  opts = { db };
  // createContact emits events through pg-boss, which reads the validated env.
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const setCrm = (tenant: string, enabled: boolean, level = 'lite') =>
  tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${tenant}, 'crm', ${enabled}, ${level})
    on conflict (tenant_id, module_key) do update set enabled = ${enabled}, level = ${level}`;

describe('M1-05 companies service (F-10)', () => {
  it('module off: every function throws ModuleDisabledError (403) and writes nothing', async () => {
    const before =
      await tdb.admin`select count(*)::int as n from companies where tenant_id = ${IDS.tenantA}`;
    const e = await createCompany(ctx.ownerA(), { name: 'Nope' }, opts).catch((x) => x);
    expect(e).toBeInstanceOf(ModuleDisabledError);
    expect(e.status).toBe(403);
    expect(e.code).toBe('MODULE_DISABLED');
    await expect(listCompanies(ctx.ownerA(), {}, opts)).rejects.toBeInstanceOf(ModuleDisabledError);
    await expect(getCompany(ctx.ownerA(), a.contactId, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    await expect(
      updateCompany(ctx.ownerA(), a.contactId, { name: 'x' }, opts)
    ).rejects.toBeInstanceOf(ModuleDisabledError);
    await expect(deleteCompany(ctx.ownerA(), a.contactId, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    await expect(getCompanyDetail(ctx.ownerA(), a.contactId, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    const after =
      await tdb.admin`select count(*)::int as n from companies where tenant_id = ${IDS.tenantA}`;
    expect(after[0].n).toBe(before[0].n);
  });

  it('a disabled crm row is still off; Lite and Full both allow companies', async () => {
    await setCrm(IDS.tenantA, false);
    await expect(listCompanies(ctx.ownerA(), {}, opts)).rejects.toBeInstanceOf(ModuleDisabledError);
    await setCrm(IDS.tenantA, true, 'lite');
    await expect(listCompanies(ctx.ownerA(), {}, opts)).resolves.toBeDefined();
    await setCrm(IDS.tenantA, true, 'full');
    await expect(listCompanies(ctx.ownerA(), {}, opts)).resolves.toBeDefined();
    await setCrm(IDS.tenantA, true, 'lite');
  });

  it('creates with E.164 phone and website normalisation, audits, and rejects bad input', async () => {
    const c = await createCompany(
      ctx.ownerA(),
      {
        name: '  Acme Property Management ',
        phone: '(415) 555-0150',
        website: 'acme.example.test'
      },
      opts
    );
    expect(c.name).toBe('Acme Property Management');
    expect(c.phoneE164).toBe('+14155550150');
    expect(c.website).toBe('https://acme.example.test/');
    expect(c.tenantId).toBe(IDS.tenantA);
    const [row] =
      await tdb.admin`select * from audit_log where action = 'company.create' and entity_id = ${c.id}`;
    expect(row.actor_user_id).toBe(IDS.ownerA);

    await expect(
      createCompany(ctx.ownerA(), { name: 'Bad', phone: 'abc' }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      createCompany(ctx.ownerA(), { name: 'Bad', website: 'javascript:alert(1)' }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(createCompany(ctx.ownerA(), { name: '   ' }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(
      createCompany(ctx.ownerA(), { name: 'x', tenantId: IDS.tenantB } as never, opts)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates, audits the changed fields, and can clear phone and website', async () => {
    const c = await createCompany(ctx.ownerA(), { name: 'Edit Me', phone: '415-555-0151' }, opts);
    const u = await updateCompany(
      ctx.ownerA(),
      c.id,
      { name: 'Edited', phone: null, website: 'https://e.example.test' },
      opts
    );
    expect(u.name).toBe('Edited');
    expect(u.phoneE164).toBeNull();
    const [row] =
      await tdb.admin`select before, after from audit_log where action = 'company.update' and entity_id = ${c.id}`;
    expect(Object.keys(row.after).toSorted()).toEqual(['name', 'phone', 'website']);
    expect(row.before.phone).toBe('+14155550151');
    // A no-op patch writes no audit row.
    await updateCompany(ctx.ownerA(), c.id, { name: 'Edited' }, opts);
    const n =
      await tdb.admin`select count(*)::int as n from audit_log where action = 'company.update' and entity_id = ${c.id}`;
    expect(n[0].n).toBe(1);
  });

  it('F-10: a company with 3 contacts and 2 deals shows both roll-ups with totals', async () => {
    const co = await createCompany(ctx.ownerA(), { name: 'Rollup Co' }, opts);
    const mk = (first: string, phone: string) =>
      createContact(ctx.ownerA(), { firstName: first, phones: [phone], companyId: co.id }, opts);
    const [c1, c2, c3] = await Promise.all([
      mk('R1', '415-555-0161'),
      mk('R2', '415-555-0162'),
      mk('R3', '415-555-0163')
    ]);
    // A fourth contact that is soft-deleted must not count.
    const gone = await mk('Gone', '415-555-0164');
    await tdb.admin`update contacts set deleted_at = now() where id = ${gone.id}`;

    const [d1] =
      await tdb.admin`insert into deals (tenant_id, pipeline_id, stage_id, title, value_cents, position)
      values (${IDS.tenantA}, ${a.pipelineId}, ${a.stageId}, 'Open job', 250000, 'a1') returning id`;
    const [d2] =
      await tdb.admin`insert into deals (tenant_id, pipeline_id, stage_id, title, value_cents, position, won_at)
      values (${IDS.tenantA}, ${a.pipelineId}, ${a.stageId}, 'Won job', 400000, 'a2', now()) returning id`;
    const [d3] =
      await tdb.admin`insert into deals (tenant_id, pipeline_id, stage_id, title, value_cents, position, deleted_at)
      values (${IDS.tenantA}, ${a.pipelineId}, ${a.stageId}, 'Deleted job', 999999, 'a3', now()) returning id`;
    // d1 has two of the company's contacts: it still counts once.
    for (const [deal, contact] of [
      [d1, c1],
      [d1, c2],
      [d2, c3],
      [d3, c1],
      [d2, gone]
    ] as const) {
      await tdb.admin`insert into deal_contacts (tenant_id, deal_id, contact_id, role)
        values (${IDS.tenantA}, ${deal.id}, ${contact.id}, 'homeowner')`;
    }

    const detail = await getCompanyDetail(ctx.ownerA(), co.id, opts);
    expect(detail.rollup).toEqual({
      contactCount: 3,
      dealCount: 2,
      totalValueCents: 650000,
      openValueCents: 250000,
      wonValueCents: 400000
    });
    expect(detail.contacts.map((c) => c.firstName)).toEqual(['R1', 'R2', 'R3']);
    expect(detail.deals.map((d) => d.title).toSorted()).toEqual(['Open job', 'Won job']);
    expect(detail.deals[0].stage).toBe('New');

    const list = await listCompanies(ctx.ownerA(), { q: 'rollup' }, opts);
    expect(list.total).toBe(1);
    expect(list.items[0]).toMatchObject({ id: co.id, contactCount: 3, dealCount: 2 });
  });

  it('lists by name with search (wildcards are literal), paging and total', async () => {
    for (const name of ['Zed 100% Roofing', 'Zed 100x Roofing', 'Zed Gutters']) {
      await createCompany(ctx.ownerA(), { name }, opts);
    }
    expect(
      (await listCompanies(ctx.ownerA(), { q: '100%' }, opts)).items.map((i) => i.name)
    ).toEqual(['Zed 100% Roofing']);
    const all = await listCompanies(ctx.ownerA(), { q: 'zed', limit: 2 }, opts);
    expect(all.total).toBe(3);
    expect(all.items).toHaveLength(2);
    const next = await listCompanies(ctx.ownerA(), { q: 'zed', limit: 2, offset: 2 }, opts);
    expect(next.items).toHaveLength(1);
  });

  it('delete is soft, detaches contacts, and the company leaves lists and detail', async () => {
    const co = await createCompany(ctx.ownerA(), { name: 'Short Lived' }, opts);
    const ct = await createContact(
      ctx.ownerA(),
      { firstName: 'Stay', phones: ['415-555-0170'], companyId: co.id },
      opts
    );
    await deleteCompany(ctx.ownerA(), co.id, opts);
    const [row] = await tdb.admin`select deleted_at from companies where id = ${co.id}`;
    expect(row.deleted_at).not.toBeNull();
    await expect(getCompany(ctx.ownerA(), co.id, opts)).rejects.toBeInstanceOf(NotFoundError);
    expect((await listCompanies(ctx.ownerA(), { q: 'Short Lived' }, opts)).total).toBe(0);
    const [c] = await tdb.admin`select company_id, deleted_at from contacts where id = ${ct.id}`;
    expect(c.company_id).toBeNull();
    expect(c.deleted_at).toBeNull();
    await expect(deleteCompany(ctx.ownerA(), co.id, opts)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('tenant isolation: tenant B cannot read, change or delete tenant A companies (404)', async () => {
    await setCrm(IDS.tenantB, true, 'lite');
    const co = await createCompany(ctx.ownerA(), { name: 'A only' }, opts);
    await expect(getCompany(ctx.ownerB(), co.id, opts)).rejects.toBeInstanceOf(NotFoundError);
    await expect(getCompanyDetail(ctx.ownerB(), co.id, opts)).rejects.toBeInstanceOf(NotFoundError);
    await expect(
      updateCompany(ctx.ownerB(), co.id, { name: 'hijack' }, opts)
    ).rejects.toBeInstanceOf(NotFoundError);
    await expect(deleteCompany(ctx.ownerB(), co.id, opts)).rejects.toBeInstanceOf(NotFoundError);
    const names = (await listCompanies(ctx.ownerB(), {}, opts)).items.map((i) => i.name);
    expect(names).not.toContain('A only');
    // And a contact cannot be pointed at another tenant's company (composite FK).
    const bContact = await createContact(
      ctx.ownerB(),
      { firstName: 'B', phones: ['415-555-0180'] },
      opts
    );
    await expect(
      updateContact(ctx.ownerB(), bContact.id, { companyId: co.id }, opts)
    ).rejects.toThrow();
  });
});
