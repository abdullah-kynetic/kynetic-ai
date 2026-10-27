import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import {
  billingTotals,
  getTenantBilling,
  setTenantPlanTier,
  snapshotModulePrice,
  updateBillingProfile,
  type BillingActor
} from '@/server/billing';
import { setTenantModule } from '@/server/modules/admin';
import { withTenant } from '@/server/tenancy';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let opts: { db: ReturnType<typeof createDb> };
const admin: BillingActor = { id: IDS.admin, kyneticRole: 'admin' };
const va: BillingActor = { id: IDS.va, kyneticRole: 'va' };
const owner: BillingActor = { id: IDS.ownerA, kyneticRole: null };
const A = IDS.tenantA;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  opts = { db: createDb(db.app) };
});
afterAll(async () => {
  await db?.drop();
});

const audit = (action: string) =>
  db.admin`select actor_user_id, before, after from audit_log
    where tenant_id = ${A} and action = ${action} order by created_at`;
const live = (module: string) =>
  db.admin`select setup_cents, monthly_cents, discount_pct, level from tenant_billing_modules
    where tenant_id = ${A} and module_key = ${module} and ended_at is null`;

describe('F-86, F-99 billing profile (M8a-07)', () => {
  it('owner and VA get FORBIDDEN on every read and write; nothing is written', async () => {
    for (const actor of [va, owner]) {
      await expect(getTenantBilling(actor, A, opts)).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        setTenantPlanTier(actor, { tenantId: A, pricingTier: 'T3' }, opts)
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        updateBillingProfile(actor, { tenantId: A, notes: 'x' }, opts)
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(
        snapshotModulePrice(actor, { tenantId: A, moduleKey: 'opm' }, opts)
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    }
    expect((await db.admin`select notes from tenant_billing where tenant_id = ${A}`)[0].notes).toBe(
      null
    );
  });

  it('the database refuses billing rows to owner and staff roles, and to every app write', async () => {
    const ownerCtx = { tenantId: A, userId: IDS.ownerA, role: 'owner' as const };
    const staffCtx = { tenantId: A, userId: IDS.staffA, role: 'staff' as const };
    for (const c of [ownerCtx, staffCtx]) {
      for (const t of ['tenant_billing', 'tenant_billing_modules'] as const) {
        const rows = await withTenant(c, (tx) => tx.execute(`select 1 from ${t}` as never), opts);
        expect(rows.length, t).toBe(0);
      }
    }
    await expect(
      withTenant(
        { tenantId: A, userId: IDS.admin, role: 'admin' },
        (tx) =>
          tx.execute(
            `update tenant_billing set notes = 'direct' where tenant_id = '${A}'` as never
          ),
        opts
      )
    ).rejects.toThrow();
  });

  it('stores plan and tier, audited with before and after', async () => {
    await setTenantPlanTier(admin, { tenantId: A, plan: 'founding', pricingTier: 'T2' }, opts);
    const view = await getTenantBilling(admin, A, opts);
    expect(view.tenant).toMatchObject({ plan: 'founding', pricingTier: 'T2' });
    expect(view.foundingReference).toContain('$6,500');
    const rows = await audit('tenant.commercial_update');
    expect(rows.at(-1)).toMatchObject({ actor_user_id: IDS.admin });
    expect(rows.at(-1)?.after).toMatchObject({ pricing_tier: 'T2' });

    await setTenantPlanTier(admin, { tenantId: A, plan: 'value' }, opts);
    expect((await getTenantBilling(admin, A, opts)).foundingReference).toBeNull();
    await setTenantPlanTier(admin, { tenantId: A, plan: 'founding' }, opts);
  });

  it('snapshots the price when a module is enabled; a later catalogue change does not move it', async () => {
    await setTenantModule(admin, { tenantId: A, moduleKey: 'quote_followup', enabled: true }, opts);
    await setTenantModule(
      admin,
      { tenantId: A, moduleKey: 'crm', enabled: true, level: 'lite' },
      opts
    );
    expect(await live('quote_followup')).toMatchObject([
      { setup_cents: 450000, monthly_cents: 150000 }
    ]);
    expect(await live('crm')).toMatchObject([
      { setup_cents: 100000, monthly_cents: 50000, level: 'lite' }
    ]);
    expect((await audit('billing.snapshot')).length).toBe(2);

    await db.admin`update module_prices set monthly_cents = 999999 where module_key = 'quote_followup' and tier = 'T2'`;
    const view = await getTenantBilling(admin, A, opts);
    expect(view.lines.find((l) => l.moduleKey === 'quote_followup')?.monthlyCents).toBe(150000);
    // alex_core (fixture row 650000/150000) + quote_followup + crm lite
    expect(view.totals).toEqual({
      setupCents: 650000 + 450000 + 100000,
      monthlyCents: 150000 + 150000 + 50000
    });
  });

  it('changing the CRM level ends the old snapshot and takes a new one; switching off ends it', async () => {
    await setTenantModule(
      admin,
      { tenantId: A, moduleKey: 'crm', enabled: true, level: 'full' },
      opts
    );
    expect(await live('crm')).toMatchObject([
      { setup_cents: 200000, monthly_cents: 75000, level: 'full' }
    ]);
    expect(
      (
        await db.admin`select 1 from tenant_billing_modules where tenant_id = ${A} and module_key = 'crm'`
      ).length
    ).toBe(2);
    await setTenantModule(admin, { tenantId: A, moduleKey: 'crm', enabled: false }, opts);
    expect(await live('crm')).toHaveLength(0);
  });

  it('a module enabled before the tier is set shows as unpriced until recorded, with a discount', async () => {
    await setTenantPlanTier(admin, { tenantId: IDS.tenantB, plan: 'value' }, opts);
    await setTenantModule(admin, { tenantId: IDS.tenantB, moduleKey: 'opm', enabled: true }, opts);
    expect((await getTenantBilling(admin, IDS.tenantB, opts)).unpriced).toContain('opm');
    await expect(
      snapshotModulePrice(admin, { tenantId: IDS.tenantB, moduleKey: 'opm' }, opts)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await setTenantPlanTier(admin, { tenantId: IDS.tenantB, pricingTier: 'T1' }, opts);
    await snapshotModulePrice(
      admin,
      { tenantId: IDS.tenantB, moduleKey: 'opm', discountPct: 20 },
      opts
    );
    const view = await getTenantBilling(admin, IDS.tenantB, opts);
    expect(view.unpriced).not.toContain('opm');
    expect(view.lines.find((l) => l.moduleKey === 'opm')).toMatchObject({
      setupCents: 250000,
      monthlyCents: 100000,
      discountPct: 20
    });
    expect(billingTotals(view.lines.filter((l) => l.moduleKey === 'opm'))).toEqual({
      setupCents: 200000,
      monthlyCents: 80000
    });
    await expect(
      snapshotModulePrice(
        admin,
        { tenantId: IDS.tenantB, moduleKey: 'opm', discountPct: 101 },
        opts
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('saves the billing profile, keeps untouched fields, clears blanks, and audits each write', async () => {
    await updateBillingProfile(
      admin,
      {
        tenantId: A,
        billingStartDate: '2026-11-01',
        stripeCustomerId: 'cus_test123',
        notes: 'Invoice on the 1st'
      },
      opts
    );
    await updateBillingProfile(admin, { tenantId: A, notes: '' }, opts);
    const { profile } = await getTenantBilling(admin, A, opts);
    expect(profile).toEqual({
      billingStartDate: '2026-11-01',
      stripeCustomerId: 'cus_test123',
      notes: null
    });
    const rows = await audit('billing.update');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ actor_user_id: IDS.admin });
    expect(rows[1].before).toMatchObject({ notes: 'Invoice on the 1st' });
    await expect(
      updateBillingProfile(admin, { tenantId: A, billingStartDate: 'soon' }, opts)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('an unknown tenant is NOT_FOUND', async () => {
    const nobody = '99999999-9999-4999-8999-999999999999';
    await expect(getTenantBilling(admin, nobody, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(
      updateBillingProfile(admin, { tenantId: nobody, notes: 'x' }, opts)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
