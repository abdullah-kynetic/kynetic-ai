import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type postgres from 'postgres';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const UA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const UB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.admin`insert into tenants (id, slug, name, plan, timezone) values
    (${A}, 'tenant-a', 'Tenant A', 'founding', 'America/Los_Angeles'),
    (${B}, 'tenant-b', 'Tenant B', 'value', 'America/Chicago')`;
  await db.admin`insert into users (id, email) values (${UA}, 'a@example.test'), (${UB}, 'b@example.test')`;
  await db.admin`insert into memberships (tenant_id, user_id, role) values (${A}, ${UA}, 'owner'), (${B}, ${UB}, 'owner')`;
  await db.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${A}, 'platform', true), (${B}, 'platform', true)`;
  await db.admin`insert into tenant_secrets (tenant_id, provider, name, ciphertext, nonce) values (${A}, 'twilio', 'token', '\\x01', '\\x02')`;
  await db.admin`insert into onboarding_steps (tenant_id, step_key, title) values (${A}, 's1', 'one'), (${B}, 's1', 'one')`;
});
afterAll(async () => {
  await db?.drop();
});

/** Runs fn inside a transaction as the app role with the given session context. */
async function asApp(
  ctx: { tenant?: string; user?: string; role?: string; readOnly?: boolean },
  fn: (tx: postgres.TransactionSql) => postgres.PendingQuery<postgres.Row[]>
): Promise<postgres.RowList<postgres.Row[]>> {
  return db.app.begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${ctx.tenant ?? ''}, true),
                    set_config('app.user_id', ${ctx.user ?? ''}, true),
                    set_config('app.role', ${ctx.role ?? ''}, true),
                    set_config('app.read_only', ${ctx.readOnly ? 'on' : 'off'}, true)`;
    return fn(tx);
  });
}

describe('M0-05 schema', () => {
  it('creates every part A table', async () => {
    const rows =
      await db.admin`select tablename from pg_tables where schemaname = 'public' order by tablename`;
    const names = rows.map((r) => r.tablename);
    for (const t of [
      'tenants',
      'users',
      'memberships',
      'invitations',
      'module_catalog',
      'module_prices',
      'tenant_modules',
      'tenant_secrets',
      'audit_log',
      'impersonation_sessions',
      'backup_runs',
      'terms_acceptances',
      'tenant_billing',
      'tenant_billing_modules',
      'onboarding_steps',
      'tenant_documents'
    ]) {
      expect(names, t).toContain(t);
    }
  });

  it('SEC-T-01 setup: every table with tenant_id has RLS enabled and forced, and the app role owns none', async () => {
    const rows = await db.admin`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) as owner
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)`;
    expect(rows.length).toBeGreaterThan(8);
    for (const r of rows) {
      expect(r.relrowsecurity, r.relname).toBe(true);
      expect(r.relforcerowsecurity, r.relname).toBe(true);
      expect(r.owner, r.relname).toBe('kynetic_owner');
    }
  });

  it('platform cannot be disabled and only one CRM level can be enabled', async () => {
    await expect(
      db.admin`update tenant_modules set enabled = false where module_key = 'platform'`
    ).rejects.toThrow(/check/i);
    await expect(
      db.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${A}, 'crm', true, '')`
    ).rejects.toThrow(/check/i);
    await db.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${A}, 'crm', true, 'lite')`;
    await expect(
      db.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${A}, 'crm', true, 'full')`
    ).rejects.toThrow(/duplicate|unique/i);
    await db.admin`delete from tenant_modules where tenant_id = ${A} and module_key = 'crm'`;
  });
});

describe('M0-05 isolation and privileges', () => {
  it('a tenant sees only its own rows; unset context sees nothing', async () => {
    for (const t of ['memberships', 'tenant_modules', 'onboarding_steps']) {
      const own = await asApp({ tenant: A }, (tx) => tx.unsafe(`select tenant_id from ${t}`));
      expect(own.length, t).toBeGreaterThan(0);
      expect(
        own.every((r) => r.tenant_id === A),
        t
      ).toBe(true);
      expect(await asApp({}, (tx) => tx.unsafe(`select 1 from ${t}`)), t).toHaveLength(0);
    }
    const tenants = await asApp({ tenant: A }, (tx) => tx`select id from tenants`);
    expect(tenants.map((r) => r.id)).toEqual([A]);
    expect(await asApp({}, (tx) => tx`select id from tenants`)).toHaveLength(0);
  });

  it('writing a row for another tenant is refused', async () => {
    await expect(
      asApp(
        { tenant: A },
        (tx) =>
          tx`insert into onboarding_steps (tenant_id, step_key, title) values (${B}, 'x', 'x')`
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('read_only refuses writes', async () => {
    await expect(
      asApp(
        { tenant: A, readOnly: true },
        (tx) =>
          tx`insert into onboarding_steps (tenant_id, step_key, title) values (${A}, 'ro', 'ro')`
      )
    ).rejects.toThrow(/row-level security/);
    await expect(
      asApp(
        { tenant: A, readOnly: true },
        (tx) => tx`update onboarding_steps set title = 'z' where tenant_id = ${A}`
      ).then((r) => {
        if (r.count > 0) throw new Error('updated under read_only');
      })
    ).resolves.toBeUndefined();
  });

  it('the runtime role cannot change plan, kynetic_role or modules, and cannot read secrets or the audit log', async () => {
    await expect(
      asApp({ tenant: A }, (tx) => tx`update tenants set plan = 'value' where id = ${A}`)
    ).rejects.toThrow(/permission denied/);
    await expect(
      asApp(
        { tenant: A, user: UA },
        (tx) => tx`update users set kynetic_role = 'admin' where id = ${UA}`
      )
    ).rejects.toThrow(/permission denied/);
    await expect(
      asApp(
        { tenant: A },
        (tx) => tx`update tenant_modules set enabled = true where tenant_id = ${A}`
      )
    ).rejects.toThrow(/permission denied/);
    await expect(asApp({ tenant: A }, (tx) => tx`select * from tenant_secrets`)).rejects.toThrow(
      /permission denied/
    );
    await expect(asApp({ tenant: A }, (tx) => tx`select * from audit_log`)).rejects.toThrow(
      /permission denied/
    );
  });

  it('the runtime role can update allowed tenant columns, only on its own row', async () => {
    await asApp({ tenant: A }, (tx) => tx`update tenants set name = 'Tenant A2' where id = ${A}`);
    const r = await asApp(
      { tenant: A },
      (tx) => tx`update tenants set name = 'hijack' where id = ${B}`
    );
    expect(r.count).toBe(0);
  });

  it('only the worker reads tenant_secrets', async () => {
    const rows = await db.worker`select provider from tenant_secrets`;
    expect(rows).toHaveLength(1);
  });

  it('memberships: owners write, staff do not', async () => {
    const staff = '33333333-3333-3333-3333-333333333333';
    await db.admin`insert into users (id, email) values (${staff}, 's@example.test')`;
    await asApp(
      { tenant: A, role: 'owner' },
      (tx) =>
        tx`insert into memberships (tenant_id, user_id, role) values (${A}, ${staff}, 'staff')`
    );
    await expect(
      asApp(
        { tenant: A, role: 'staff' },
        (tx) => tx`insert into memberships (tenant_id, user_id, role) values (${A}, ${UB}, 'staff')`
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('users: self and tenant members readable, other tenant not', async () => {
    const rows = await asApp(
      { tenant: A, user: UA },
      (tx) => tx`select id from users order by email`
    );
    expect(rows.map((r) => r.id)).toContain(UA);
    expect(rows.map((r) => r.id)).not.toContain(UB);
  });

  it('SEC-T-35: audit_log accepts inserts and refuses update, delete and truncate for every role', async () => {
    await asApp(
      { tenant: A },
      (tx) =>
        tx`insert into audit_log (tenant_id, action, entity) values (${A}, 'test.insert', 'test')`
    );
    for (const sql of [db.owner, db.admin]) {
      await expect(sql`update audit_log set action = 'x'`).rejects.toThrow(/append-only/);
      await expect(sql`delete from audit_log`).rejects.toThrow(/append-only/);
      await expect(sql`truncate audit_log`).rejects.toThrow(/append-only/);
    }
    await expect(db.app`update audit_log set action = 'x'`).rejects.toThrow(/permission denied/);
    await expect(db.worker`delete from audit_log`).rejects.toThrow(/permission denied/);
  });

  it('terms_acceptances: a user inserts and reads only their own', async () => {
    await asApp(
      { user: UA },
      (tx) =>
        tx`insert into terms_acceptances (user_id, document, version) values (${UA}, 'terms', 'v1')`
    );
    await expect(
      asApp(
        { user: UA },
        (tx) =>
          tx`insert into terms_acceptances (user_id, document, version) values (${UB}, 'terms', 'v1')`
      )
    ).rejects.toThrow(/row-level security/);
    expect(await asApp({ user: UB }, (tx) => tx`select * from terms_acceptances`)).toHaveLength(0);
  });

  it('module_catalog is readable but not writable by the runtime role', async () => {
    expect((await db.app`select * from module_catalog`).length).toBeGreaterThan(0);
    await expect(
      db.app`insert into module_catalog (module_key, label) values ('opm','OPM')`
    ).rejects.toThrow(/permission denied/);
  });

  it('app_module_enabled reflects the tenant row', async () => {
    expect(
      (await asApp({ tenant: A }, (tx) => tx`select app_module_enabled('platform') as e`))[0].e
    ).toBe(true);
    expect(
      (await asApp({ tenant: A }, (tx) => tx`select app_module_enabled('crm') as e`))[0].e
    ).toBe(false);
  });
});
