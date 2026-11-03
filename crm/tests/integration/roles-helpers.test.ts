import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db?.drop();
});

describe('M0-04 roles and helpers (SEC-T-01 setup)', () => {
  it('creates the five roles with the right attributes', async () => {
    const rows = await db.admin`
      select rolname, rolbypassrls, rolsuper, rolcanlogin from pg_roles
      where rolname in ('kynetic_auth','kynetic_owner','kynetic_rollup','kynetic_app','kynetic_worker') order by rolname`;
    expect(rows.map((r) => r.rolname)).toEqual([
      'kynetic_app',
      'kynetic_auth',
      'kynetic_owner',
      'kynetic_rollup',
      'kynetic_worker'
    ]);
    const by = Object.fromEntries(rows.map((r) => [r.rolname, r]));
    expect(by.kynetic_rollup).toMatchObject({ rolbypassrls: true, rolcanlogin: false });
    for (const n of ['kynetic_app', 'kynetic_auth', 'kynetic_worker', 'kynetic_owner']) {
      expect(by[n]).toMatchObject({ rolbypassrls: false, rolsuper: false });
    }
  });

  it('the database is owned by kynetic_owner and the runtime roles own nothing', async () => {
    const [d] =
      await db.admin`select pg_catalog.pg_get_userbyid(datdba) as owner from pg_database where datname = current_database()`;
    expect(d.owner).toBe('kynetic_owner');
    const owned =
      await db.admin`select proname from pg_proc p where pronamespace = 'public'::regnamespace and pg_get_userbyid(proowner) in ('kynetic_app','kynetic_worker')`;
    expect(owned).toHaveLength(0);
  });

  it('the app role cannot create objects in the public schema', async () => {
    await expect(db.app`create table app_made (id int)`).rejects.toThrow(/permission denied/);
  });

  it('helpers return NULL (or false) when the session variables are unset', async () => {
    const [r] =
      await db.app`select app_tenant_id() as t, app_user_id() as u, app_role() as r, app_impersonator_id() as i, app_read_only() as ro`;
    expect(r).toEqual({ t: null, u: null, r: null, i: null, ro: false });
  });

  it('helpers read transaction-local settings and do not leak across transactions', async () => {
    const tenant = '11111111-1111-1111-1111-111111111111';
    await db.app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${tenant}, true), set_config('app.role', 'owner', true), set_config('app.read_only', 'on', true)`;
      const [r] = await tx`select app_tenant_id() as t, app_role() as r, app_read_only() as ro`;
      expect(r).toEqual({ t: tenant, r: 'owner', ro: true });
    });
    const [after] = await db.app`select app_tenant_id() as t, app_role() as r`;
    expect(after).toEqual({ t: null, r: null });
  });

  it('app_enable_tenant_rls enables and forces RLS with the four standard policies', async () => {
    await db.owner`create table probe (id uuid primary key default gen_random_uuid(), tenant_id uuid not null)`;
    await db.owner`select app_enable_tenant_rls('probe')`;
    const [t] =
      await db.admin`select relrowsecurity, relforcerowsecurity, pg_get_userbyid(relowner) as owner from pg_class where relname = 'probe'`;
    expect(t).toMatchObject({
      relrowsecurity: true,
      relforcerowsecurity: true,
      owner: 'kynetic_owner'
    });
    const pols = await db.admin`select cmd from pg_policies where tablename = 'probe' order by cmd`;
    expect(pols.map((p) => p.cmd)).toEqual(['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
  });

  it('probe table: forged tenant reads nothing, unset reads nothing, read_only refuses writes', async () => {
    const a = '11111111-1111-1111-1111-111111111111';
    const b = '22222222-2222-2222-2222-222222222222';
    await db.app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${a}, true)`;
      await tx`insert into probe (tenant_id) values (${a})`;
      await expect(
        tx.savepoint((s) => s`insert into probe (tenant_id) values (${b})`)
      ).rejects.toThrow(/row-level security/);
    });
    await db.app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${b}, true)`;
      expect(await tx`select * from probe`).toHaveLength(0);
    });
    expect(await db.app`select * from probe`).toHaveLength(0);
    await db.app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${a}, true), set_config('app.read_only', 'on', true)`;
      expect(await tx`select * from probe`).toHaveLength(1);
      await expect(
        tx.savepoint((s) => s`insert into probe (tenant_id) values (${a})`)
      ).rejects.toThrow(/row-level security/);
    });
  });

  it('the worker role also gets tenant-scoped policies', async () => {
    const a = '11111111-1111-1111-1111-111111111111';
    await db.worker.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${a}, true)`;
      expect(await tx`select * from probe`).toHaveLength(1);
    });
    expect(await db.worker`select * from probe`).toHaveLength(0);
  });

  it('only the owner can call app_enable_tenant_rls', async () => {
    await expect(db.app`select app_enable_tenant_rls('probe')`).rejects.toThrow(
      /permission denied/
    );
  });
});
