import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// SEC-T-01, SEC-T-02, SEC-T-05: schema-level and SQL-level tenant isolation for every tenant table.

let db: TestDatabase;
let tables: string[] = [];
// The agency tables hang off agency_workspaces, which allows exactly one tenant (the synthetic Kynetic one),
// so the shared two-tenant fixture cannot seed them. They still get the RLS enabled/forced/policy check.
const SINGLE_WORKSPACE_TABLES = new Set([
  'agency_workspaces',
  'agency_campaigns',
  'agency_campaign_leads',
  'agency_call_attempts',
  'agency_proposals',
  'agency_alerts',
  'agency_dm_logs',
  'agency_message_drafts',
  'agency_campaign_progress',
  'agency_campaign_history',
  'agency_ops_settings',
  'agency_deal_terms',
  'agency_invoice_drafts',
  'agency_billing_events',
  'agency_dunning_drafts'
]);
function seededTables() {
  return tables.filter((t) => !SINGLE_WORKSPACE_TABLES.has(t));
}
const counts = new Map<string, { a: number; b: number }>();

async function count(table: string, tenant: string) {
  const [r] = await db.admin.unsafe(
    `select count(*)::int as n from ${table} where tenant_id = '${tenant}'`
  );
  return r.n as number;
}

/** Runs sql as the given runtime role in a transaction with the tenant context set. */
async function as(
  role: 'app' | 'worker',
  tenant: string | null,
  fn: (tx: postgres.TransactionSql) => postgres.PendingQuery<postgres.Row[]>,
  settings: { readOnly?: boolean } = {}
) {
  return db[role].begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${tenant ?? ''}, true), set_config('app.read_only', ${settings.readOnly ? 'on' : 'off'}, true), set_config('app.role', 'owner', true)`;
    return fn(tx);
  });
}

/** Statement result or the error class, so tests can assert "never succeeded". */
async function attempt<T>(
  p: Promise<T>
): Promise<{ ok: true; value: T } | { ok: false; message: string }> {
  try {
    return { ok: true, value: await p };
  } catch (e) {
    return { ok: false, message: String((e as Error).message) };
  }
}

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  const rows = await db.admin`
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)
    order by c.relname`;
  tables = rows.map((r) => r.relname);
  for (const t of tables)
    counts.set(t, { a: await count(t, IDS.tenantA), b: await count(t, IDS.tenantB) });
});
afterAll(async () => {
  await db?.drop();
});

describe('SEC-T-01 schema check', () => {
  it('finds the tenant tables and every one has RLS enabled, forced, and at least one policy', async () => {
    expect(tables.length).toBeGreaterThanOrEqual(40);
    const rows = await db.admin`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity,
        (select count(*)::int from pg_policy p where p.polrelid = c.oid) as policies
      from pg_class c where c.relname = any(${tables}) and c.relkind = 'r'`;
    for (const r of rows) {
      expect(r.relrowsecurity, r.relname).toBe(true);
      expect(r.relforcerowsecurity, r.relname).toBe(true);
      expect(r.policies, r.relname).toBeGreaterThan(0);
    }
  });

  it('the seed fixture put a row for both tenants in every tenant table', () => {
    for (const t of seededTables()) {
      const c = counts.get(t);
      expect(c?.a, `${t} tenant A`).toBeGreaterThan(0);
      expect(c?.b, `${t} tenant B`).toBeGreaterThan(0);
    }
  });
});

describe('SEC-T-05 role attributes', () => {
  it('app and worker are not owner, superuser or BYPASSRLS, and own no table', async () => {
    const roles =
      await db.admin`select rolname, rolsuper, rolbypassrls from pg_roles where rolname in ('kynetic_app','kynetic_worker')`;
    expect(roles).toHaveLength(2);
    for (const r of roles) expect(r).toMatchObject({ rolsuper: false, rolbypassrls: false });
    const owned =
      await db.admin`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and pg_get_userbyid(c.relowner) in ('kynetic_app','kynetic_worker')`;
    expect(owned).toEqual([]);
  });
});

describe('SEC-T-02 SQL-level isolation for every tenant table', () => {
  it('as the app role with tenant A set, a select never returns tenant B rows', async () => {
    for (const t of tables) {
      const canSelect = (
        await db.admin`select has_table_privilege('kynetic_app', ${t}, 'SELECT') as ok`
      )[0].ok;
      const res = await attempt(
        as('app', IDS.tenantA, (tx) => tx.unsafe(`select tenant_id from ${t}`))
      );
      if (!canSelect) {
        expect(res.ok, `${t} should be unreadable`).toBe(false);
        continue;
      }
      expect(res.ok, t).toBe(true);
      if (res.ok)
        expect(
          res.value.every((r) => r.tenant_id === IDS.tenantA),
          t
        ).toBe(true);
    }
  });

  it('with no tenant set, every tenant table returns zero rows', async () => {
    for (const t of tables) {
      const canSelect = (
        await db.admin`select has_table_privilege('kynetic_app', ${t}, 'SELECT') as ok`
      )[0].ok;
      if (!canSelect) continue;
      const res = await attempt(as('app', null, (tx) => tx.unsafe(`select 1 from ${t}`)));
      expect(res.ok && res.value.length, t).toBe(0);
    }
  });

  it('an insert or update that moves a row to another tenant never succeeds', async () => {
    for (const t of seededTables()) {
      // webhook_events is insert-only intake by design and carries a nullable tenant.
      if (t === 'webhook_events') continue;
      // Insert: copy tenant A's row and point it at tenant B, while the session is tenant A.
      const [rowA] = await db.admin.unsafe(
        `select to_jsonb(x) as j from ${t} x where tenant_id = '${IDS.tenantA}' limit 1`
      );
      const forged = { ...(rowA.j as Record<string, unknown>), tenant_id: IDS.tenantB };
      const ins = await attempt(
        as('app', IDS.tenantA, (tx) =>
          tx.unsafe(
            `insert into ${t} select * from jsonb_populate_record(null::${t}, $1::text::jsonb)`,
            [JSON.stringify(forged)]
          )
        )
      );
      expect(ins.ok, `insert into ${t} for tenant B`).toBe(false);
      // It must be the isolation layer that refuses, not a key clash that would hide a missing policy.
      expect(!ins.ok && ins.message, `insert into ${t} refusal`).toMatch(
        /row-level security|permission denied/
      );
      // Update: try to re-home tenant A's rows.
      const upd = await attempt(
        as('app', IDS.tenantA, (tx) =>
          tx.unsafe(
            `update ${t} set tenant_id = '${IDS.tenantB}' where tenant_id = '${IDS.tenantA}'`
          )
        )
      );
      if (upd.ok) expect((upd.value as unknown as { count: number }).count, `update ${t}`).toBe(0);
      const after = { a: await count(t, IDS.tenantA), b: await count(t, IDS.tenantB) };
      expect(after, `${t} counts unchanged`).toEqual(counts.get(t));
    }
  });

  it('with read_only on, no write changes any tenant table', async () => {
    for (const t of seededTables()) {
      const [rowA] = await db.admin.unsafe(
        `select to_jsonb(x) as j from ${t} x where tenant_id = '${IDS.tenantA}' limit 1`
      );
      const copy = { ...(rowA.j as Record<string, unknown>) };
      await attempt(
        as(
          'app',
          IDS.tenantA,
          (tx) =>
            tx.unsafe(
              `insert into ${t} select * from jsonb_populate_record(null::${t}, $1::text::jsonb)`,
              [JSON.stringify(copy)]
            ),
          { readOnly: true }
        )
      );
      await attempt(
        as(
          'app',
          IDS.tenantA,
          (tx) => tx.unsafe(`delete from ${t} where tenant_id = '${IDS.tenantA}'`),
          { readOnly: true }
        )
      );
      expect(
        { a: await count(t, IDS.tenantA), b: await count(t, IDS.tenantB) },
        `${t} counts unchanged`
      ).toEqual(counts.get(t));
    }
  });

  it('the worker role is tenant scoped too, except the documented cross-tenant tables', async () => {
    const crossTenant = new Set([
      'tenant_secrets',
      'automation_runs',
      'webhook_events',
      'backup_runs'
    ]);
    for (const t of tables) {
      if (crossTenant.has(t)) continue;
      const canSelect = (
        await db.admin`select has_table_privilege('kynetic_worker', ${t}, 'SELECT') as ok`
      )[0].ok;
      if (!canSelect) continue;
      const none = await attempt(as('worker', null, (tx) => tx.unsafe(`select 1 from ${t}`)));
      expect(none.ok && none.value.length, `${t} unset`).toBe(0);
      const a = await attempt(
        as('worker', IDS.tenantA, (tx) => tx.unsafe(`select tenant_id from ${t}`))
      );
      expect(a.ok && a.value.every((r) => r.tenant_id === IDS.tenantA), t).toBe(true);
    }
  });
});
