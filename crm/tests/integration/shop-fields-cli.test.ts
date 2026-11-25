import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ensureShopFields } from '@/server/db/seed/shop-fields';
import { AUTO_BODY_FIELDS } from '@/server/shop/custom-fields';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
const slug = 'tenant-a';
const count = async () =>
  Number(
    (
      await tdb.admin`select count(*)::int as n from custom_field_defs
        where tenant_id = ${IDS.tenantA} and entity = 'deal'`
    )[0]!.n
  );

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
});
afterAll(async () => tdb?.drop());

describe('shop fields command', () => {
  it('does nothing for a tenant without the module or a missing tenant', async () => {
    expect((await ensureShopFields(tdb.admin, { slug, apply: true })).status).toBe('no-module');
    expect((await ensureShopFields(tdb.admin, { slug: 'nope', apply: true })).status).toBe(
      'no-tenant'
    );
    expect(await count()).toBe(0);
  });

  it('is a dry run by default, applies once, and leaves edited fields alone', async () => {
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled)
      values (${IDS.tenantA}, 'shop_ops', true)`;
    const dry = await ensureShopFields(tdb.admin, { slug });
    expect(dry.status).toBe('planned');
    expect(dry.missing).toHaveLength(AUTO_BODY_FIELDS.length);
    expect(await count()).toBe(0);
    const applied = await ensureShopFields(tdb.admin, { slug, apply: true });
    expect(applied.status).toBe('applied');
    expect(await count()).toBe(AUTO_BODY_FIELDS.length);
    await tdb.admin`update custom_field_defs set label = 'Car year'
      where tenant_id = ${IDS.tenantA} and key = 'vehicle_year'`;
    const again = await ensureShopFields(tdb.admin, { slug, apply: true });
    expect(again.missing).toEqual([]);
    expect(await count()).toBe(AUTO_BODY_FIELDS.length);
    const [row] = await tdb.admin`select label, options from custom_field_defs
      where tenant_id = ${IDS.tenantA} and key = 'payment_type'`;
    expect(row!.options).toEqual(['Out-of-pocket', 'Insurance']);
    const [yr] = await tdb.admin`select label from custom_field_defs
      where tenant_id = ${IDS.tenantA} and key = 'vehicle_year'`;
    expect(yr!.label).toBe('Car year');
  });
});
