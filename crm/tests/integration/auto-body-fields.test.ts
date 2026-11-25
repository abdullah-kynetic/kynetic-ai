import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { listFieldDefs, updateFieldDef } from '@/server/custom-fields';
import { AUTO_BODY_FIELDS, ensureAutoBodyFields } from '@/server/shop/custom-fields';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  opts = { db: createDb(tdb.app) };
});
afterAll(async () => tdb?.drop());

describe('A-4 auto body custom fields', () => {
  it('creates the nine deal fields once and is a no-op the second time', async () => {
    const first = await ensureAutoBodyFields(ctx.ownerA(), opts);
    expect(first.created).toHaveLength(AUTO_BODY_FIELDS.length);
    expect(first.created).toEqual(
      expect.arrayContaining([
        'vehicle_year',
        'vehicle_make',
        'vehicle_model',
        'payment_type',
        'insurer',
        'claim_number',
        'estimate_amount',
        'drop_off_date',
        'tech'
      ])
    );
    const second = await ensureAutoBodyFields(ctx.ownerA(), opts);
    expect(second.created).toEqual([]);
    expect(second.existing).toHaveLength(AUTO_BODY_FIELDS.length);
    const defs = await listFieldDefs(ctx.ownerA(), 'deal', opts);
    expect(defs.filter((d) => AUTO_BODY_FIELDS.some((f) => f.key === d.key))).toHaveLength(9);
    const payment = defs.find((d) => d.key === 'payment_type')!;
    expect(payment).toMatchObject({ type: 'select', options: ['Out-of-pocket', 'Insurance'] });
  });

  it('leaves a field the client edited as it is, and never touches another tenant', async () => {
    const defs = await listFieldDefs(ctx.ownerA(), 'deal', opts);
    const tech = defs.find((d) => d.key === 'tech')!;
    await updateFieldDef(ctx.ownerA(), tech.id, { label: 'Technician' }, opts);
    await ensureAutoBodyFields(ctx.ownerA(), opts);
    const after = await listFieldDefs(ctx.ownerA(), 'deal', opts);
    expect(after.find((d) => d.key === 'tech')!.label).toBe('Technician');
    const other = await listFieldDefs(ctx.ownerB(), 'deal', opts);
    expect(other.filter((d) => AUTO_BODY_FIELDS.some((f) => f.key === d.key))).toHaveLength(0);
  });

  it('only an owner or admin may create the fields', async () => {
    await expect(
      ensureAutoBodyFields({ tenantId: IDS.tenantB, userId: IDS.va, role: 'va' }, opts)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const result = await ensureAutoBodyFields(ctx.ownerB(), opts);
    expect(result.created).toHaveLength(AUTO_BODY_FIELDS.length);
  });
});
