import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
});
afterAll(async () => {
  await db?.drop();
});

type Ctx = { role?: string; user?: string; tenant?: string };
async function call(
  ctx: Ctx,
  fn: (tx: postgres.TransactionSql) => postgres.PendingQuery<postgres.Row[]>
): Promise<postgres.Row[]> {
  return db.app.begin(async (tx) => {
    await tx`select set_config('app.role', ${ctx.role ?? ''}, true), set_config('app.user_id', ${ctx.user ?? ''}, true), set_config('app.tenant_id', ${ctx.tenant ?? ''}, true)`;
    return fn(tx);
  });
}
const admin = { role: 'admin', user: IDS.admin };

describe('M0-09 roll-up functions', () => {
  it('the roll-up role is NOLOGIN with BYPASSRLS and owns the functions; app and worker do not', async () => {
    const [r] =
      await db.admin`select rolcanlogin, rolbypassrls from pg_roles where rolname = 'kynetic_rollup'`;
    expect(r).toEqual({ rolcanlogin: false, rolbypassrls: true });
    const fns =
      await db.admin`select proname, pg_get_userbyid(proowner) as owner, prosecdef, proconfig
      from pg_proc where pronamespace = 'public'::regnamespace and proname in
      ('create_tenant','set_tenant_module','admin_update_tenant_commercial','admin_set_kynetic_role','admin_tenant_overview','audit_search')`;
    expect(fns).toHaveLength(6);
    for (const f of fns) {
      expect(f.owner, f.proname).toBe('kynetic_rollup');
      expect(f.prosecdef, f.proname).toBe(true);
      expect(String(f.proconfig), f.proname).toMatch(/search_path=public/);
    }
  });

  it('no RLS policy grants a staff role cross-tenant access', async () => {
    const pols =
      await db.admin`select tablename, policyname, coalesce(qual,'') || ' ' || coalesce(with_check,'') as expr from pg_policies where schemaname = 'public'`;
    for (const p of pols) {
      if (/app_role\(\)\s*=\s*'(admin|va)'/.test(p.expr)) {
        // The only role clause allowed narrows within a tenant (alex_prompts), it never widens.
        expect(p.expr, `${p.tablename}.${p.policyname}`).toMatch(/app_tenant_id\(\)/);
      }
      expect(p.expr, `${p.tablename}.${p.policyname}`).not.toMatch(/kynetic_role|is_admin/i);
    }
  });

  it('set_tenant_module: owner and VA are refused, admin writes one module row and one audit row', async () => {
    for (const role of ['owner', 'staff', 'va']) {
      await expect(
        call(
          { role, user: IDS.ownerA, tenant: IDS.tenantA },
          (tx) => tx`select set_tenant_module(${IDS.tenantA}, 'crm', true, 'lite')`
        )
      ).rejects.toMatchObject({ code: '42501' });
    }
    await expect(
      call({}, (tx) => tx`select set_tenant_module(${IDS.tenantA}, 'crm', true, 'lite')`)
    ).rejects.toMatchObject({ code: '42501' });
    const before = (
      await db.admin`select count(*)::int as n from audit_log where action = 'module.toggle'`
    )[0].n;
    await call(admin, (tx) => tx`select set_tenant_module(${IDS.tenantA}, 'crm', true, 'lite')`);
    const rows =
      await db.admin`select enabled, level, changed_by from tenant_modules where tenant_id = ${IDS.tenantA} and module_key = 'crm'`;
    expect(rows).toEqual([{ enabled: true, level: 'lite', changed_by: IDS.admin }]);
    const audit =
      await db.admin`select actor_user_id, tenant_id, before, after from audit_log where action = 'module.toggle' order by created_at desc limit 1`;
    expect(
      (await db.admin`select count(*)::int as n from audit_log where action = 'module.toggle'`)[0].n
    ).toBe(before + 1);
    expect(audit[0]).toMatchObject({
      actor_user_id: IDS.admin,
      tenant_id: IDS.tenantA,
      before: null
    });
    // Upgrade lite -> full records the before value.
    await call(admin, (tx) => tx`select set_tenant_module(${IDS.tenantA}, 'crm', true, 'full')`);
    const up =
      await db.admin`select before from audit_log where action = 'module.toggle' order by created_at desc limit 1`;
    expect(up[0].before).toMatchObject({ level: 'lite', enabled: true });
  });

  it('set_tenant_module keeps the table rules: platform cannot be disabled', async () => {
    await expect(
      call(admin, (tx) => tx`select set_tenant_module(${IDS.tenantA}, 'platform', false, '')`)
    ).rejects.toThrow(/check/i);
  });

  it('create_tenant: refused for non-admin; for admin creates everything or nothing', async () => {
    await expect(
      call(
        { role: 'va', user: IDS.va },
        (tx) =>
          tx`select create_tenant('new-co','New Co','founding','America/Denver','o@example.test','th',now()+interval '7 days')`
      )
    ).rejects.toMatchObject({ code: '42501' });
    const [{ create_tenant: id }] = await call(
      admin,
      (tx) =>
        tx`select create_tenant('new-co','New Co','founding','America/Denver','Owner@Example.test','tokenhash',now()+interval '7 days')`
    );
    const stages =
      await db.admin`select name, is_won, is_lost from pipeline_stages where tenant_id = ${id} order by position`;
    expect(stages.map((s) => s.name)).toEqual([
      'New',
      'Contacted',
      'Qualified',
      'Estimate Booked',
      'Estimate Done',
      'Quoted',
      'Won',
      'Lost'
    ]);
    expect(stages.filter((s) => s.is_won)).toHaveLength(1);
    expect(
      (await db.admin`select email, role from invitations where tenant_id = ${id}`)[0]
    ).toEqual({ email: 'owner@example.test', role: 'owner' });
    expect(
      (await db.admin`select module_key from tenant_modules where tenant_id = ${id}`).map(
        (r) => r.module_key
      )
    ).toEqual(['platform']);
    expect(
      (await db.admin`select paused from alex_configs where tenant_id = ${id}`)[0].paused
    ).toBe(true);
    expect(
      (
        await db.admin`select count(*)::int as n from audit_log where action = 'tenant.create' and tenant_id = ${id}`
      )[0].n
    ).toBe(1);
    // Failure midway leaves nothing behind (duplicate slug).
    await expect(
      call(
        admin,
        (tx) =>
          tx`select create_tenant('new-co','Again','founding','America/Denver','x@example.test','h2',now()+interval '7 days')`
      )
    ).rejects.toThrow(/duplicate|unique/i);
    expect(
      (await db.admin`select count(*)::int as n from invitations where token_hash = 'h2'`)[0].n
    ).toBe(0);
  });

  it('admin_update_tenant_commercial: admin only, allowlisted fields, audited', async () => {
    await expect(
      call(
        { role: 'va', user: IDS.va },
        (tx) => tx`select admin_update_tenant_commercial(${IDS.tenantA}, '{"plan":"value"}'::jsonb)`
      )
    ).rejects.toMatchObject({ code: '42501' });
    await expect(
      call(
        admin,
        (tx) =>
          tx`select admin_update_tenant_commercial(${IDS.tenantA}, '{"name":"Hacked"}'::jsonb)`
      )
    ).rejects.toMatchObject({ code: '22023' });
    await call(
      admin,
      (tx) =>
        tx`select admin_update_tenant_commercial(${IDS.tenantA}, '{"plan":"value","pricing_tier":"T2","guarantee_target_bookings":12,"guarantee_start_date":"2026-10-01"}'::jsonb)`
    );
    expect(
      (
        await db.admin`select plan, pricing_tier, guarantee_target_bookings from tenants where id = ${IDS.tenantA}`
      )[0]
    ).toEqual({ plan: 'value', pricing_tier: 'T2', guarantee_target_bookings: 12 });
    const a =
      await db.admin`select before, after from audit_log where action = 'tenant.commercial_update' order by created_at desc limit 1`;
    expect(a[0].before).toMatchObject({ plan: 'founding' });
  });

  it('admin_set_kynetic_role: admin only', async () => {
    await expect(
      call(
        { role: 'va', user: IDS.va },
        (tx) => tx`select admin_set_kynetic_role(${IDS.va}, 'admin')`
      )
    ).rejects.toMatchObject({ code: '42501' });
    await call(admin, (tx) => tx`select admin_set_kynetic_role(${IDS.ownerB}, 'va')`);
    expect(
      (await db.admin`select kynetic_role from users where id = ${IDS.ownerB}`)[0].kynetic_role
    ).toBe('va');
    await expect(
      call(admin, (tx) => tx`select admin_set_kynetic_role(${IDS.ownerB}, 'root')`)
    ).rejects.toMatchObject({ code: '22023' });
    await call(admin, (tx) => tx`select admin_set_kynetic_role(${IDS.ownerB}, null)`);
  });

  it('runtime role cannot change commercial fields or kynetic_role directly', async () => {
    await expect(
      call(
        { role: 'owner', tenant: IDS.tenantA },
        (tx) => tx`update tenants set plan = 'founding' where id = ${IDS.tenantA}`
      )
    ).rejects.toThrow(/permission denied/);
  });

  it('admin_tenant_overview: admin and VA, aggregates only, one row per tenant; clients refused', async () => {
    for (const ctx of [admin, { role: 'va', user: IDS.va }]) {
      const rows = await call(ctx, (tx) => tx`select * from admin_tenant_overview()`);
      expect(rows.map((r) => r.slug)).toContain('tenant-a');
      const cols = Object.keys(rows[0]);
      for (const banned of ['email', 'phone', 'first_name', 'last_name', 'body', 'transcript']) {
        expect(
          cols.some((c) => c.includes(banned)),
          banned
        ).toBe(false);
      }
    }
    await expect(
      call(
        { role: 'owner', tenant: IDS.tenantA },
        (tx) => tx`select * from admin_tenant_overview()`
      )
    ).rejects.toMatchObject({ code: '42501' });
    const a = (await call(admin, (tx) => tx`select * from admin_tenant_overview()`)).find(
      (r) => r.slug === 'tenant-a'
    );
    expect(a?.leads_30d).toBe(1);
    expect(a?.appointments_30d).toBe(1);
    expect(Number(a?.booking_rate)).toBe(1);
  });

  it('audit_search: admin and VA read; clients refused', async () => {
    const rows = await call(
      admin,
      (tx) => tx`select * from audit_search(${IDS.tenantA}, null, 'module.toggle')`
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.tenant_id === IDS.tenantA && r.action === 'module.toggle')).toBe(
      true
    );
    await call({ role: 'va', user: IDS.va }, (tx) => tx`select * from audit_search()`);
    await expect(
      call({ role: 'owner', tenant: IDS.tenantA }, (tx) => tx`select * from audit_search()`)
    ).rejects.toMatchObject({ code: '42501' });
  });

  it('audit_log stays append-only for the roll-up role too', async () => {
    await expect(db.owner`update audit_log set action = 'x'`).rejects.toThrow(/append-only/);
  });

  it('the web role cannot call the internal helpers or the roll-up owner role directly', async () => {
    await expect(db.app`select rollup_audit(null, 'x', 'y', null, null, null)`).rejects.toThrow(
      /permission denied/
    );
    await expect(db.app`set role kynetic_rollup`).rejects.toThrow(
      /permission denied|must be member/
    );
  });
});
