import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { requireModule, ModuleDisabledError } from '@/server/modules';
import {
  getTenantModules,
  listModuleHistory,
  setTenantModule,
  type ModuleActor
} from '@/server/modules/admin';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let opts: { db: ReturnType<typeof createDb> };
const admin: ModuleActor = { id: IDS.admin, kyneticRole: 'admin' };
const va: ModuleActor = { id: IDS.va, kyneticRole: 'va' };
const owner: ModuleActor = { id: IDS.ownerA, kyneticRole: null };

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  opts = { db: createDb(db.app) };
});
afterAll(async () => {
  await db?.drop();
});

const auditRows = (tenant: string) =>
  db.admin`select action, actor_user_id, before, after from audit_log
    where tenant_id = ${tenant} and action = 'module.toggle' order by created_at`;

describe('F-70 admin modules panel service (M8a-06)', () => {
  it('only an admin may read or change flags: VA, owner and nobody get FORBIDDEN', async () => {
    for (const actor of [va, owner]) {
      await expect(getTenantModules(actor, IDS.tenantA, opts)).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      await expect(
        setTenantModule(actor, { tenantId: IDS.tenantA, moduleKey: 'opm', enabled: true }, opts)
      ).rejects.toMatchObject({ code: 'FORBIDDEN' });
      await expect(listModuleHistory(actor, IDS.tenantA, opts)).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
    }
    expect((await db.admin`select 1 from tenant_modules where module_key = 'opm'`).length).toBe(0);
  });

  it('lists every module, including ones with no row, and platform is always on', async () => {
    const { tenant, modules } = await getTenantModules(admin, IDS.tenantA, opts);
    expect(tenant.id).toBe(IDS.tenantA);
    expect(modules.map((m) => m.moduleKey)).toContain('crm');
    expect(modules.find((m) => m.moduleKey === 'platform')?.enabled).toBe(true);
    expect(modules.find((m) => m.moduleKey === 'opm')?.enabled).toBe(false);
  });

  it('an unknown tenant is NOT_FOUND', async () => {
    await expect(
      getTenantModules(admin, '99999999-9999-4999-8999-999999999999', opts)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      setTenantModule(
        admin,
        { tenantId: '99999999-9999-4999-8999-999999999999', moduleKey: 'opm', enabled: true },
        opts
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('toggle writes an audit row and takes effect on the next request; data stays', async () => {
    await expect(requireModule(ctx.ownerA(), 'reactivation', opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    const before = (await auditRows(IDS.tenantA)).length;
    expect(
      await setTenantModule(
        admin,
        { tenantId: IDS.tenantA, moduleKey: 'reactivation', enabled: true },
        opts
      )
    ).toEqual({ changed: true });
    await expect(requireModule(ctx.ownerA(), 'reactivation', opts)).resolves.toBeUndefined();

    const rows = await auditRows(IDS.tenantA);
    expect(rows.length).toBe(before + 1);
    expect(rows.at(-1)).toMatchObject({ actor_user_id: IDS.admin });
    expect(rows.at(-1)?.after).toMatchObject({ module_key: 'reactivation', enabled: true });

    const contactsBefore = (await db.admin`select count(*)::int n from contacts`)[0].n;
    await setTenantModule(
      admin,
      { tenantId: IDS.tenantA, moduleKey: 'reactivation', enabled: false },
      opts
    );
    await expect(requireModule(ctx.ownerA(), 'reactivation', opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    expect((await db.admin`select count(*)::int n from contacts`)[0].n).toBe(contactsBefore);
  });

  it("tenant A's flags never affect tenant B", async () => {
    await setTenantModule(admin, { tenantId: IDS.tenantA, moduleKey: 'opm', enabled: true }, opts);
    await expect(requireModule(ctx.ownerB(), 'opm', opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
  });

  it('repeating the current state is a no-op with no audit row', async () => {
    const n = (await auditRows(IDS.tenantA)).length;
    expect(
      await setTenantModule(admin, { tenantId: IDS.tenantA, moduleKey: 'opm', enabled: true }, opts)
    ).toEqual({ changed: false });
    expect((await auditRows(IDS.tenantA)).length).toBe(n);
  });

  it('crm needs a level to turn on; level moves lite to full; off keeps the level', async () => {
    await expect(
      setTenantModule(admin, { tenantId: IDS.tenantA, moduleKey: 'crm', enabled: true }, opts)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await setTenantModule(
      admin,
      { tenantId: IDS.tenantA, moduleKey: 'crm', enabled: true, level: 'lite' },
      opts
    );
    await expect(
      requireModule(ctx.ownerA(), 'crm', { ...opts, level: 'full' })
    ).rejects.toBeInstanceOf(ModuleDisabledError);
    expect(
      await setTenantModule(
        admin,
        { tenantId: IDS.tenantA, moduleKey: 'crm', enabled: true, level: 'full' },
        opts
      )
    ).toEqual({ changed: true });
    await expect(
      requireModule(ctx.ownerA(), 'crm', { ...opts, level: 'full' })
    ).resolves.toBeUndefined();

    await setTenantModule(admin, { tenantId: IDS.tenantA, moduleKey: 'crm', enabled: false }, opts);
    const crm = (await getTenantModules(admin, IDS.tenantA, opts)).modules.find(
      (m) => m.moduleKey === 'crm'
    );
    expect(crm).toMatchObject({ enabled: false, level: 'full' });
  });

  it('platform cannot be switched; level is refused on other modules', async () => {
    await expect(
      setTenantModule(admin, { tenantId: IDS.tenantA, moduleKey: 'platform', enabled: false }, opts)
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      setTenantModule(
        admin,
        { tenantId: IDS.tenantA, moduleKey: 'opm', enabled: true, level: 'full' },
        opts
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('history lists this tenant only, newest first, with before and after', async () => {
    const history = await listModuleHistory(admin, IDS.tenantA, opts);
    expect(history.length).toBeGreaterThanOrEqual(5);
    expect(history[0].at.getTime()).toBeGreaterThanOrEqual(history.at(-1)!.at.getTime());
    expect(history.every((h) => h.actorUserId === IDS.admin)).toBe(true);
    const crmOff = history.find((h) => h.moduleKey === 'crm' && !h.after.enabled);
    expect(crmOff).toMatchObject({ before: { enabled: true, level: 'full' } });
    expect(await listModuleHistory(admin, IDS.tenantB, opts)).toEqual([]);
  });
});
