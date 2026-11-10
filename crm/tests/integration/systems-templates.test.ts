import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { onboardTenant } from '@/server/admin/onboarding';
import { applyIndustryTemplate, applySystemTemplate } from '@/server/admin/templates';
import { setGuaranteeBaseline } from '@/server/admin/client-overview';
import { getGuaranteeSettings } from '@/server/metrics';
import { createDb } from '@/server/db/client';
import type { Actor } from '@/server/auth/permissions';
import {
  listOwnSystemRequests,
  listSystemRequestQueue,
  requestSystem
} from '@/server/systems/requests';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: ReturnType<typeof createDb>;
const admin = { id: IDS.admin, kyneticRole: 'admin' as const };
const va = { id: IDS.va, kyneticRole: 'va' as const };
const ownerA: Actor = {
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantA, role: 'owner', canExport: true, canBulkDelete: true },
  viewAs: null
};
const ownerB: Actor = {
  userId: IDS.ownerB,
  kyneticRole: null,
  membership: { tenantId: IDS.tenantB, role: 'owner', canExport: true, canBulkDelete: true },
  viewAs: null
};

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => tdb?.drop());

const audits = (action: string, tenant: string) =>
  tdb.admin`select id from audit_log where action = ${action} and tenant_id = ${tenant}`;

describe('systems, templates, and the 30-day guarantee', () => {
  it('onboards a remodeler onto editable default stages and applies twice as a no-op', async () => {
    const created = await onboardTenant(
      { userId: IDS.admin, role: 'admin' },
      {
        businessName: 'Harbor Bath Kitchen',
        ownerEmail: 'harbor@example.test',
        phone: '4155550199',
        industry: 'remodeling',
        timezone: 'America/Los_Angeles',
        hours: { days: ['mon'], open: '08:00', close: '17:00' },
        plan: 'founding'
      },
      { db }
    );
    const stages =
      await tdb.admin`select name from pipeline_stages where tenant_id = ${created.tenantId} order by position`;
    expect(stages.map((row) => row.name)).toEqual([
      'New lead',
      'Consultation booked',
      'Design in progress',
      'Proposal sent',
      'Contract signed',
      'Build scheduled',
      'Won',
      'Lost'
    ]);
    const services = await tdb.admin`select services from tenants where id = ${created.tenantId}`;
    expect(services[0]?.services).toEqual([
      'Bathroom remodel',
      'Kitchen remodel',
      'Design consultation'
    ]);
    const before = (await audits('template.apply', created.tenantId)).length;
    const again = await applyIndustryTemplate(
      admin,
      { tenantId: created.tenantId, industry: 'remodeling' },
      { db }
    );
    expect(again).toMatchObject({ changed: false, stages: 'unchanged', services: 'unchanged' });
    expect((await audits('template.apply', created.tenantId)).length).toBe(before);
  });

  it('does not rename a pipeline that is no longer the default, and does not repeat a service write', async () => {
    const first = await applyIndustryTemplate(
      admin,
      { tenantId: IDS.tenantA, industry: 'remodeling' },
      { db }
    );
    expect(first.stages).toBe('customized');
    expect(first.services).toBe('replace');
    expect(first.changed).toBe(true);
    const names =
      await tdb.admin`select name from pipeline_stages where tenant_id = ${IDS.tenantA} order by position`;
    expect(names.map((row) => row.name)).toEqual(['New']);
    const second = await applyIndustryTemplate(
      admin,
      { tenantId: IDS.tenantA, industry: 'remodeling' },
      { db }
    );
    expect(second.changed).toBe(false);
    await expect(
      applyIndustryTemplate(va, { tenantId: IDS.tenantA, industry: 'remodeling' }, { db })
    ).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('turns a system on once, including its specified automations', async () => {
    const first = await applySystemTemplate(
      admin,
      { tenantId: IDS.tenantB, moduleKey: 'quote_followup' },
      { db }
    );
    expect(first.changed).toBe(true);
    const [mod] =
      await tdb.admin`select enabled from tenant_modules where tenant_id = ${IDS.tenantB} and module_key = 'quote_followup'`;
    expect(mod?.enabled).toBe(true);
    const [auto] =
      await tdb.admin`select enabled from automations where tenant_id = ${IDS.tenantB} and template_key = 'quote_followup'`;
    expect(auto?.enabled).toBe(true);
    const before = (await audits('template.apply', IDS.tenantB)).length;
    const second = await applySystemTemplate(
      admin,
      { tenantId: IDS.tenantB, moduleKey: 'quote_followup' },
      { db }
    );
    expect(second.changed).toBe(false);
    expect((await audits('template.apply', IDS.tenantB)).length).toBe(before);
    await expect(
      applySystemTemplate(admin, { tenantId: IDS.tenantB, moduleKey: 'platform' }, { db })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('records one audited request per system and keeps it inside the tenant', async () => {
    const before = (await audits('system.request', IDS.tenantA)).length;
    const first = await requestSystem(ctx.ownerA(), ownerA, { moduleKey: 'opm' }, { db });
    const second = await requestSystem(ctx.ownerA(), ownerA, { moduleKey: 'opm' }, { db });
    expect(first.created).toBe(true);
    expect(second).toEqual({ id: first.id, created: false });
    expect((await audits('system.request', IDS.tenantA)).length).toBe(before + 1);
    const mine = await listOwnSystemRequests(ctx.ownerA(), ownerA, { db });
    const theirs = await listOwnSystemRequests(ctx.ownerB(), ownerB, { db });
    expect(mine.map((row) => row.id)).toContain(first.id);
    expect(theirs.map((row) => row.id)).not.toContain(first.id);
    await expect(
      requestSystem(ctx.ownerA(), ownerA, { moduleKey: 'alex_core' }, { db })
    ).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    const queue = await listSystemRequestQueue({ userId: IDS.admin, role: 'admin' }, { db });
    expect(queue.some((row) => row.id === first.id && row.tenantName === 'Tenant A')).toBe(true);
    await expect(
      tdb.app.begin(async (tx) => {
        await tx`select set_config('app.tenant_id', ${IDS.tenantA}, true), set_config('app.role', 'owner', true), set_config('app.user_id', ${IDS.ownerA}, true)`;
        await tx`update system_requests set status = 'open' where tenant_id = ${IDS.tenantA}`;
      })
    ).rejects.toThrow(/permission denied/);
  });

  it('stores an admin baseline override and measures the 30-day window', async () => {
    await tdb.admin`insert into appointments (tenant_id, starts_at, ends_at, booked_by, created_at, status) values
      (${IDS.tenantB}, '2026-09-15T15:00:00Z', '2026-09-15T16:00:00Z', 'alex', '2026-09-15T12:00:00Z', 'scheduled'),
      (${IDS.tenantB}, '2026-10-05T15:00:00Z', '2026-10-05T16:00:00Z', 'alex', '2026-10-05T12:00:00Z', 'scheduled')`;
    await setGuaranteeBaseline(
      admin,
      { tenantId: IDS.tenantB, baseline: null, startDate: '2026-10-01' },
      { db }
    );
    const measured = await getGuaranteeSettings(ctx.ownerB(), { db });
    expect(measured.measuredBaseline).toBe(1);
    expect(measured.bookedInWindow).toBe(1);
    expect(measured.baselineOverride).toBeNull();
    await setGuaranteeBaseline(
      admin,
      { tenantId: IDS.tenantB, baseline: 10, startDate: '2026-10-01' },
      { db }
    );
    const overridden = await getGuaranteeSettings(ctx.ownerB(), { db });
    expect(overridden.baselineOverride).toBe(10);
    expect((await audits('tenant.commercial_update', IDS.tenantB)).length).toBeGreaterThan(0);
    await expect(
      setGuaranteeBaseline(
        va,
        { tenantId: IDS.tenantB, baseline: 1, startDate: '2026-10-01' },
        { db }
      )
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });
});
