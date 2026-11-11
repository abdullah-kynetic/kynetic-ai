import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  addDealContact,
  listDealContacts,
  listDealsForContact,
  removeDealContact,
  setDealContactRole
} from '@/server/deals';
import { ModuleDisabledError } from '@/server/modules';
import { ctx, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
let b: Awaited<ReturnType<typeof seedTwoTenants>>['b'];
let spouseId: string;

const setCrm = (tenant: string, level: string, enabled = true) =>
  tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${tenant}, 'crm', ${enabled}, ${level})
    on conflict (tenant_id, module_key) do update set enabled = ${enabled}, level = ${level}`;

beforeAll(async () => {
  tdb = await createTestDatabase();
  ({ a, b } = await seedTwoTenants(tdb.admin));
  opts = { db: createDb(tdb.app) };
  await setCrm(a.tenantId, 'full');
  const [c] =
    await tdb.admin`insert into contacts (tenant_id, first_name, last_name, primary_phone_e164)
    values (${a.tenantId}, 'Sam', 'Spouse', '+14155550123') returning id`;
  spouseId = c.id;
});
afterAll(async () => {
  await tdb?.drop();
});

describe('M2-04 multi-contact deals (F-15, CRM Full)', () => {
  it('adds a spouse with a role; role shows on the deal and the deal on the contact page', async () => {
    const added = await addDealContact(
      ctx.ownerA(),
      a.dealId,
      { contactId: spouseId, role: 'spouse' },
      opts
    );
    expect(added).toMatchObject({ role: 'spouse', name: 'Sam Spouse' });
    const onDeal = await listDealContacts(ctx.ownerA(), a.dealId, opts);
    expect(onDeal.find((c) => c.contactId === spouseId)?.role).toBe('spouse');
    const forContact = await listDealsForContact(ctx.ownerA(), spouseId, opts);
    expect(forContact).toEqual([
      expect.objectContaining({
        dealId: a.dealId,
        role: 'spouse',
        stageName: expect.any(String),
        stageIsWon: expect.any(Boolean),
        stageIsLost: expect.any(Boolean)
      })
    ]);
  });

  it('refuses a second link of the same contact', async () => {
    await expect(
      addDealContact(ctx.ownerA(), a.dealId, { contactId: spouseId, role: 'tenant' }, opts)
    ).rejects.toMatchObject({ fieldErrors: { contactId: ['already_on_deal'] } });
  });

  it('changes and removes a role', async () => {
    await setDealContactRole(ctx.ownerA(), a.dealId, spouseId, 'property_manager', opts);
    expect((await listDealContacts(ctx.ownerA(), a.dealId, opts)).map((c) => c.role)).toContain(
      'property_manager'
    );
    await removeDealContact(ctx.ownerA(), a.dealId, spouseId, opts);
    expect(await listDealsForContact(ctx.ownerA(), spouseId, opts)).toEqual([]);
    await expect(removeDealContact(ctx.ownerA(), a.dealId, spouseId, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('rejects an unknown role', async () => {
    await expect(
      addDealContact(ctx.ownerA(), a.dealId, { contactId: spouseId, role: 'cousin' as never }, opts)
    ).rejects.toBeTruthy();
  });

  it("refuses a contact from another tenant, and another tenant's deal reads as not found", async () => {
    await expect(
      addDealContact(ctx.ownerA(), a.dealId, { contactId: b.contactId, role: 'other' }, opts)
    ).rejects.toMatchObject({ fieldErrors: { contactId: ['not_found'] } });
    await expect(
      addDealContact(ctx.ownerA(), b.dealId, { contactId: spouseId, role: 'other' }, opts)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(listDealContacts(ctx.ownerA(), b.dealId, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('a lite tenant gets 403 MODULE_DISABLED and nothing is written', async () => {
    await setCrm(a.tenantId, 'lite');
    const err = await addDealContact(
      ctx.ownerA(),
      a.dealId,
      { contactId: spouseId, role: 'spouse' },
      opts
    ).catch((e) => e);
    expect(err).toBeInstanceOf(ModuleDisabledError);
    expect(err).toMatchObject({ code: 'MODULE_DISABLED', status: 403 });
    await expect(listDealContacts(ctx.ownerA(), a.dealId, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    await expect(
      setDealContactRole(ctx.ownerA(), a.dealId, spouseId, 'tenant', opts)
    ).rejects.toBeInstanceOf(ModuleDisabledError);
    await expect(removeDealContact(ctx.ownerA(), a.dealId, spouseId, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    const rows = await tdb.admin`select 1 from deal_contacts where contact_id = ${spouseId}`;
    expect(rows).toHaveLength(0);
  });

  it('a tenant without crm is refused; tenant A flags do not affect tenant B', async () => {
    await setCrm(a.tenantId, 'full', false);
    await expect(listDealContacts(ctx.ownerA(), a.dealId, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    await setCrm(a.tenantId, 'full');
    await expect(listDealContacts(ctx.ownerB(), b.dealId, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
  });
});
