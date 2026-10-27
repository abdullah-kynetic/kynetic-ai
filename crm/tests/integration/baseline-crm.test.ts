import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';
const CRM_TABLES = [
  'companies',
  'custom_field_defs',
  'contacts',
  'pipelines',
  'pipeline_stages',
  'deals',
  'deal_contacts',
  'activities',
  'tasks',
  'notes',
  'note_mentions'
];

let db: TestDatabase;
let contactA: string;
let contactB: string;
let dealA: string;
let dealB: string;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.admin`insert into tenants (id, slug, name, plan, timezone) values
    (${A}, 'tenant-a', 'Tenant A', 'founding', 'America/Los_Angeles'),
    (${B}, 'tenant-b', 'Tenant B', 'value', 'America/Chicago')`;
  [{ id: contactA }] =
    await db.admin`insert into contacts (tenant_id, first_name, primary_phone_e164) values (${A}, 'Ann', '+15555550101') returning id`;
  [{ id: contactB }] =
    await db.admin`insert into contacts (tenant_id, first_name, primary_phone_e164) values (${B}, 'Bob', '+15555550102') returning id`;
  for (const t of [A, B]) {
    const [p] =
      await db.admin`insert into pipelines (tenant_id, name, is_default) values (${t}, 'Sales', true) returning id`;
    const [s] =
      await db.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position) values (${t}, ${p.id}, 'New', 0) returning id`;
    const [d] =
      await db.admin`insert into deals (tenant_id, pipeline_id, stage_id, title, position) values (${t}, ${p.id}, ${s.id}, 'Roof', 'a0') returning id`;
    if (t === A) dealA = d.id;
    else dealB = d.id;
  }
});
afterAll(async () => {
  await db?.drop();
});

describe('M0-06 schema', () => {
  it('creates all CRM tables with RLS enabled and forced', async () => {
    const rows = await db.admin`select relname, relrowsecurity, relforcerowsecurity from pg_class
      where relname = any(${CRM_TABLES}) and relkind = 'r'`;
    expect(rows.map((r) => r.relname).sort()).toEqual([...CRM_TABLES].sort());
    for (const r of rows) {
      expect(r.relrowsecurity, r.relname).toBe(true);
      expect(r.relforcerowsecurity, r.relname).toBe(true);
    }
  });

  it('every index on a tenant table starts with tenant_id, except the documented global ones', async () => {
    const idx = await db.admin`select tablename, indexname, indexdef from pg_indexes
      where schemaname = 'public' and tablename = any(${CRM_TABLES})`;
    const allowed = new Set(['contacts_custom_gin', 'contacts_name_trgm']);
    const keyed = new Set(['deal_contacts_pkey', 'note_mentions_pkey']);
    for (const i of idx) {
      if (allowed.has(i.indexname) || keyed.has(i.indexname)) continue;
      if (i.indexname.endsWith('pkey')) continue;
      const cols = /\((.*)\)/.exec(i.indexdef)?.[1] ?? '';
      const first = cols.split(',')[0].trim();
      const ok =
        first === 'tenant_id' ||
        (i.indexname.endsWith('_key') && /tenant_id/.test(cols)) ||
        /pipeline_id/.test(first) ||
        i.indexname.startsWith('pipelines_one_default') ||
        i.indexname.startsWith('pipeline_stages_pipeline_id_name_key');
      expect(ok, `${i.indexname}: ${i.indexdef}`).toBe(true);
    }
  });
});

describe('M0-06 constraints', () => {
  it('a contact needs at least one phone or email', async () => {
    await expect(
      db.admin`insert into contacts (tenant_id, first_name) values (${A}, 'Nobody')`
    ).rejects.toThrow(/check/i);
  });

  it('rejects non-E.164 phones and upper-case emails', async () => {
    await expect(
      db.admin`insert into contacts (tenant_id, primary_phone_e164) values (${A}, '5555550101')`
    ).rejects.toThrow(/check/i);
    await expect(
      db.admin`insert into contacts (tenant_id, primary_email) values (${A}, 'A@Example.com')`
    ).rejects.toThrow(/check/i);
  });

  it('Lost needs a reason; won and lost are exclusive', async () => {
    await expect(db.admin`update deals set lost_at = now() where id = ${dealA}`).rejects.toThrow(
      /check/i
    );
    await expect(
      db.admin`update deals set won_at = now(), lost_at = now(), lost_reason = 'x' where id = ${dealA}`
    ).rejects.toThrow(/check/i);
    await db.admin`update deals set lost_at = now(), lost_reason = 'price' where id = ${dealA}`;
    await db.admin`update deals set lost_at = null, lost_reason = null where id = ${dealA}`;
  });

  it('only one default pipeline per tenant', async () => {
    await expect(
      db.admin`insert into pipelines (tenant_id, name, is_default) values (${A}, 'Second', true)`
    ).rejects.toThrow(/duplicate|unique/i);
  });

  it('F-15: a contact in tenant A cannot be linked to a deal in tenant B (composite FK)', async () => {
    await expect(
      db.admin`insert into deal_contacts (tenant_id, deal_id, contact_id, role) values (${A}, ${dealA}, ${contactB}, 'homeowner')`
    ).rejects.toThrow(/foreign key/i);
    await expect(
      db.admin`insert into deal_contacts (tenant_id, deal_id, contact_id, role) values (${A}, ${dealB}, ${contactA}, 'homeowner')`
    ).rejects.toThrow(/foreign key/i);
    await db.admin`insert into deal_contacts (tenant_id, deal_id, contact_id, role) values (${A}, ${dealA}, ${contactA}, 'homeowner')`;
  });

  it("activities cannot point at another tenant's contact or deal", async () => {
    await expect(
      db.admin`insert into activities (tenant_id, contact_id, type, summary, actor_type) values (${A}, ${contactB}, 'system', 's', 'system')`
    ).rejects.toThrow(/foreign key/i);
    await expect(
      db.admin`insert into activities (tenant_id, deal_id, type, summary, actor_type) values (${A}, ${dealB}, 'system', 's', 'system')`
    ).rejects.toThrow(/foreign key/i);
  });

  it('a note needs a parent', async () => {
    await expect(
      db.admin`insert into notes (tenant_id, body_text) values (${A}, 'orphan')`
    ).rejects.toThrow(/check/i);
  });

  it('deleting a contact nulls only the reference column on activities', async () => {
    const [c] =
      await db.admin`insert into contacts (tenant_id, primary_email) values (${A}, 'x@example.test') returning id`;
    await db.admin`insert into activities (tenant_id, contact_id, type, summary, actor_type) values (${A}, ${c.id}, 'system', 'kept', 'system')`;
    await db.admin`delete from contacts where id = ${c.id}`;
    const [a] = await db.admin`select tenant_id, contact_id from activities where summary = 'kept'`;
    expect(a).toEqual({ tenant_id: A, contact_id: null });
  });
});

describe('M0-06 isolation', () => {
  async function asApp<T>(tenant: string, fn: (tx: typeof db.app) => Promise<T>) {
    return db.app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${tenant}, true)`;
      return fn(tx as unknown as typeof db.app);
    }) as Promise<T>;
  }

  it('tenant A sees only tenant A contacts, deals and stages; unset context sees none', async () => {
    for (const t of ['contacts', 'deals', 'pipelines', 'pipeline_stages']) {
      const rows = await asApp(A, (tx) => tx.unsafe(`select tenant_id from ${t}`));
      expect(rows.length, t).toBeGreaterThan(0);
      expect(
        rows.every((r) => r.tenant_id === A),
        t
      ).toBe(true);
      expect(await db.app.unsafe(`select 1 from ${t}`), t).toHaveLength(0);
    }
  });

  it('tenant A cannot insert a contact for tenant B', async () => {
    await expect(
      asApp(
        A,
        (tx) => tx`insert into contacts (tenant_id, primary_email) values (${B}, 'z@example.test')`
      )
    ).rejects.toThrow(/row-level security/);
  });

  it('tenant A can write its own contacts', async () => {
    await asApp(
      A,
      (tx) => tx`insert into contacts (tenant_id, primary_email) values (${A}, 'own@example.test')`
    );
  });
});
