import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { requireModule, ModuleDisabledError, MODULE_KEYS } from '@/server/modules';
import { getTenantModules, setTenantModule, type ModuleActor } from '@/server/modules/admin';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let opts: { db: ReturnType<typeof createDb> };
const admin: ModuleActor = { id: IDS.admin, kyneticRole: 'admin' };

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  opts = { db: createDb(db.app) };
});
afterAll(async () => {
  await db?.drop();
});

describe('A-1 shop_ops is a module key', () => {
  it('is in MODULE_KEYS and has a module_catalog row, off by default', async () => {
    expect(MODULE_KEYS).toContain('shop_ops');
    const rows = await db.admin`select module_key, always_on from module_catalog
      where module_key = 'shop_ops'`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.always_on).toBe(false);
  });

  it('the guard refuses while off and allows once an admin switches it on', async () => {
    await expect(requireModule(ctx.ownerA(), 'shop_ops', opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    await setTenantModule(
      admin,
      { tenantId: IDS.tenantA, moduleKey: 'shop_ops', enabled: true },
      opts
    );
    await expect(requireModule(ctx.ownerA(), 'shop_ops', opts)).resolves.toBeUndefined();
    // Tenant B was never switched on: the flag does not leak across tenants.
    await expect(requireModule(ctx.ownerB(), 'shop_ops', opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
  });

  it('the admin module list includes shop_ops', async () => {
    const { modules } = await getTenantModules(admin, IDS.tenantA, opts);
    expect(modules.map((m) => m.moduleKey)).toContain('shop_ops');
  });
});

describe('A-2 the migration is idempotent', () => {
  it('running 1097 again changes nothing and adds no second row', async () => {
    const sqlText = readFileSync('drizzle/1097_shop_ops_module.sql', 'utf8');
    const before = await db.admin`select count(*)::int as n from module_catalog`;
    for (const statement of sqlText.split('--> statement-breakpoint')) {
      await db.admin.unsafe(statement);
    }
    const after = await db.admin`select count(*)::int as n from module_catalog`;
    expect(after[0]!.n).toBe(before[0]!.n);
    const force =
      await db.admin`select relforcerowsecurity from pg_class where relname = 'module_catalog'`;
    expect(force[0]!.relforcerowsecurity).toBe(true);
  });

  it('the check constraint still rejects an unknown module key', async () => {
    await expect(
      db.admin`insert into module_catalog (module_key, label) values ('nope', 'Nope')`
    ).rejects.toThrow();
  });
});
