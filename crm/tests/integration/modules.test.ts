import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import {
  isModuleEnabled,
  listEnabledModules,
  MODULE_KEYS,
  ModuleDisabledError,
  moduleDisabledResponse,
  requireModule,
  type ModuleKey
} from '@/server/modules';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let opts: { db: ReturnType<typeof createDb> };
beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  opts = { db: createDb(db.app) };
});
afterAll(async () => {
  await db?.drop();
});

const setModule = (tenant: string, key: string, enabled: boolean, level = '') =>
  db.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${tenant}, ${key}, ${enabled}, ${level})
    on conflict (tenant_id, module_key) do update set enabled = ${enabled}, level = ${level}`;

// Seeded: both tenants have platform and alex_core on. Tenant A is the subject.
const NEEDS_FLAG = MODULE_KEYS.filter((k) => k !== 'platform' && k !== 'alex_core');

describe('SEC-T-12 module gate, every module key', () => {
  it('platform and a tenant with alex_core pass', async () => {
    await expect(requireModule(ctx.ownerA(), 'platform', opts)).resolves.toBeUndefined();
    await expect(requireModule(ctx.ownerA(), 'alex_core', opts)).resolves.toBeUndefined();
  });

  for (const key of NEEDS_FLAG) {
    it(`${key}: refused while off, allowed once on`, async () => {
      // text-back is also on when after_hours is, so make sure that is off first
      await setModule(IDS.tenantA, 'after_hours', false);
      const level = key === 'crm' ? 'lite' : '';
      await setModule(IDS.tenantA, key, false, level);
      await expect(requireModule(ctx.ownerA(), key, opts)).rejects.toBeInstanceOf(
        ModuleDisabledError
      );
      await setModule(IDS.tenantA, key, true, level);
      await expect(requireModule(ctx.ownerA(), key, opts)).resolves.toBeUndefined();
      await setModule(IDS.tenantA, key, false, level);
    });
  }

  it('alex_core refused when switched off', async () => {
    await setModule(IDS.tenantB, 'alex_core', false);
    await expect(requireModule(ctx.ownerB(), 'alex_core', opts)).rejects.toMatchObject({
      code: 'MODULE_DISABLED',
      status: 403
    });
    await setModule(IDS.tenantB, 'alex_core', true);
  });

  it('flags are per tenant', async () => {
    await setModule(IDS.tenantA, 'opm', true);
    expect(await isModuleEnabled(ctx.ownerA(), 'opm', opts)).toBe(true);
    expect(await isModuleEnabled(ctx.ownerB(), 'opm', opts)).toBe(false);
    await setModule(IDS.tenantA, 'opm', false);
  });

  it('a change takes effect on the next call, no stale cache', async () => {
    await setModule(IDS.tenantA, 'reactivation', true);
    expect(await isModuleEnabled(ctx.ownerA(), 'reactivation', opts)).toBe(true);
    await setModule(IDS.tenantA, 'reactivation', false);
    expect(await isModuleEnabled(ctx.ownerA(), 'reactivation', opts)).toBe(false);
  });

  it('text-back comes with after_hours and not the other way round', async () => {
    await setModule(IDS.tenantA, 'after_hours', true);
    expect(await isModuleEnabled(ctx.ownerA(), 'missed_call_textback', opts)).toBe(true);
    await setModule(IDS.tenantA, 'after_hours', false);
    await setModule(IDS.tenantA, 'missed_call_textback', true);
    expect(await isModuleEnabled(ctx.ownerA(), 'after_hours', opts)).toBe(false);
    await setModule(IDS.tenantA, 'missed_call_textback', false);
  });

  it('crm lite is refused on Full-only surfaces; a downgrade keeps data but hides surfaces', async () => {
    await setModule(IDS.tenantA, 'crm', true, 'lite');
    await expect(
      requireModule(ctx.ownerA(), 'crm', { ...opts, level: 'lite' })
    ).resolves.toBeUndefined();
    await expect(
      requireModule(ctx.ownerA(), 'crm', { ...opts, level: 'full' })
    ).rejects.toBeInstanceOf(ModuleDisabledError);
    await setModule(IDS.tenantA, 'crm', true, 'full');
    await expect(
      requireModule(ctx.ownerA(), 'crm', { ...opts, level: 'full' })
    ).resolves.toBeUndefined();
    await setModule(IDS.tenantA, 'crm', false, 'full');
    await expect(requireModule(ctx.ownerA(), 'crm', opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
  });

  it('the route response is 403 MODULE_DISABLED with the standard body', async () => {
    const res = moduleDisabledResponse(new ModuleDisabledError('opm' satisfies ModuleKey));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({
      ok: false,
      error: { code: 'MODULE_DISABLED', message: expect.stringContaining('opm') }
    });
  });

  it('listEnabledModules lists what is on, including free text-back', async () => {
    await setModule(IDS.tenantA, 'after_hours', true);
    const list = await listEnabledModules(ctx.ownerA(), opts);
    expect(list).toEqual(['platform', 'alex_core', 'after_hours', 'missed_call_textback']);
    await setModule(IDS.tenantA, 'after_hours', false);
  });
});
