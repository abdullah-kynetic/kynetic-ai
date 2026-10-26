import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

// Tables created by the gap-check additions and seed reference tables; not rows of the Entities table.
const EXTRA_TABLES = [
  'automation_templates',
  'terms_acceptances',
  'tenant_billing',
  'tenant_billing_modules',
  'onboarding_steps',
  'tenant_documents',
  // Better-Auth tables (M0-10); global, no tenant_id.
  'sessions',
  'accounts',
  'verifications',
  // Staff TOTP (M0-12); global, auth role only.
  'two_factors'
];

function entitiesFromDoc(): string[] {
  const doc = readFileSync(
    fileURLToPath(new URL('../../../docs/DATABASE.md', import.meta.url)),
    'utf8'
  );
  const start = doc.indexOf('## Entities');
  const end = doc.indexOf('Module-specific tables not yet defined', start);
  const names: string[] = [];
  for (const line of doc.slice(start, end).split('\n')) {
    const m = /^\| ([a-z_, ]+) \|/.exec(line);
    if (!m || m[1].startsWith('Entity')) continue;
    names.push(
      ...m[1]
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    );
  }
  return names;
}

let db: TestDatabase;
let contactA: string;

beforeAll(async () => {
  db = await createTestDatabase();
  await db.admin`insert into tenants (id, slug, name, plan, timezone) values
    (${A}, 'tenant-a', 'Tenant A', 'founding', 'America/Los_Angeles'),
    (${B}, 'tenant-b', 'Tenant B', 'value', 'America/Chicago')`;
  [{ id: contactA }] =
    await db.admin`insert into contacts (tenant_id, primary_phone_e164) values (${A}, '+15555550101') returning id`;
});
afterAll(async () => {
  await db?.drop();
});

async function asApp(
  role: 'app' | 'worker',
  ctx: { tenant?: string; role?: string },
  fn: (tx: any) => Promise<unknown>
) {
  return db[role].begin(async (tx) => {
    await tx`select set_config('app.tenant_id', ${ctx.tenant ?? ''}, true), set_config('app.role', ${ctx.role ?? ''}, true)`;
    return fn(tx);
  });
}

describe('M0-07 schema', () => {
  it('the table list equals the DATABASE.md Entities table (plus the documented extras)', async () => {
    const rows = await db.admin`select tablename from pg_tables where schemaname = 'public'`;
    const actual = rows.map((r) => r.tablename).sort();
    const expected = [...new Set([...entitiesFromDoc(), ...EXTRA_TABLES])].sort();
    // `users` is shared with the auth library and is in both lists;.
    expect(actual).toEqual(expected);
  });

  it('every table with tenant_id has RLS enabled and forced, owned by kynetic_owner', async () => {
    const rows = await db.admin`
      select c.relname, c.relrowsecurity, c.relforcerowsecurity, pg_get_userbyid(c.relowner) as owner
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r'
        and exists (select 1 from pg_attribute a where a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped)`;
    expect(rows.length).toBeGreaterThan(30);
    for (const r of rows) {
      expect(r.relrowsecurity, r.relname).toBe(true);
      expect(r.relforcerowsecurity, r.relname).toBe(true);
      expect(r.owner, r.relname).toBe('kynetic_owner');
    }
  });

  it('every table has RLS enabled (global tables included)', async () => {
    const rows =
      await db.admin`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`;
    expect(rows.map((r) => r.relname)).toEqual([]);
  });

  it('F-92: imported records carry source, batch and external id columns', async () => {
    const cols = await db.admin`select table_name, column_name from information_schema.columns
      where table_schema = 'public' and column_name in ('imported_source','import_batch_id','external_id')`;
    for (const t of ['contacts', 'companies', 'deals', 'notes']) {
      expect(
        cols
          .filter((c) => c.table_name === t)
          .map((c) => c.column_name)
          .sort()
      ).toEqual(['external_id', 'import_batch_id', 'imported_source']);
    }
  });
});

describe('M0-07 constraints', () => {
  it('provider call ids are unique per tenant and provider (webhook idempotency backstop)', async () => {
    await db.admin`insert into calls (tenant_id, provider, provider_call_id, direction, started_at) values (${A}, 'elevenlabs', 'c1', 'outbound', now())`;
    await expect(
      db.admin`insert into calls (tenant_id, provider, provider_call_id, direction, started_at) values (${A}, 'elevenlabs', 'c1', 'outbound', now())`
    ).rejects.toThrow(/duplicate|unique/i);
    await db.admin`insert into calls (tenant_id, provider, provider_call_id, direction, started_at) values (${B}, 'elevenlabs', 'c1', 'outbound', now())`;
  });

  it("calls cannot link to another tenant's contact", async () => {
    const [cb] =
      await db.admin`insert into contacts (tenant_id, primary_phone_e164) values (${B}, '+15555550102') returning id`;
    await expect(
      db.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at) values (${A}, ${cb.id}, 'p', 'x', 'inbound', now())`
    ).rejects.toThrow(/foreign key/i);
  });

  it('webhook events are idempotent by (source, external_id)', async () => {
    await db.admin`insert into webhook_events (source, external_id, payload) values ('twilio', 'm1', '{}')`;
    await expect(
      db.admin`insert into webhook_events (source, external_id, payload) values ('twilio', 'm1', '{}')`
    ).rejects.toThrow(/duplicate|unique/i);
  });

  it('an inbound number maps to one tenant', async () => {
    await db.admin`insert into phone_numbers (tenant_id, e164, provider, provider_sid, purpose) values (${A}, '+15555550100', 'twilio', 'PN1', 'sms')`;
    await expect(
      db.admin`insert into phone_numbers (tenant_id, e164, provider, provider_sid, purpose) values (${B}, '+15555550100', 'twilio', 'PN2', 'sms')`
    ).rejects.toThrow(/duplicate|unique/i);
  });

  it('an active automation run needs next_run_at; a template automation needs a template key', async () => {
    await db.admin`insert into module_catalog (module_key, label) values ('alex_core', 'Alex')`;
    await db.admin`insert into automation_templates (key, module_key, label) values ('speed_to_lead', 'alex_core', 'Speed to lead')`;
    const [auto] =
      await db.admin`insert into automations (tenant_id, kind, template_key, name) values (${A}, 'template', 'speed_to_lead', 'S') returning id`;
    await expect(
      db.admin`insert into automation_runs (tenant_id, automation_id, contact_id) values (${A}, ${auto.id}, ${contactA})`
    ).rejects.toThrow(/check/i);
    await expect(
      db.admin`insert into automations (tenant_id, kind, name) values (${A}, 'template', 'bad')`
    ).rejects.toThrow(/check/i);
  });

  it('only one active prompt per tenant', async () => {
    await db.admin`insert into alex_prompts (tenant_id, version, body, is_active) values (${A}, 1, 'p1', true)`;
    await expect(
      db.admin`insert into alex_prompts (tenant_id, version, body, is_active) values (${A}, 2, 'p2', true)`
    ).rejects.toThrow(/duplicate|unique/i);
  });
});

describe('M0-07 privileges and isolation', () => {
  it('consents are append only for the runtime roles', async () => {
    await asApp(
      'app',
      { tenant: A },
      (tx) =>
        tx`insert into consents (tenant_id, contact_id, channel, kind, source) values (${A}, ${contactA}, 'sms', 'express_written', 'form')`
    );
    await expect(
      asApp('app', { tenant: A }, (tx) => tx`update consents set revoked_at = now()`)
    ).rejects.toThrow(/permission denied/);
    await expect(asApp('worker', { tenant: A }, (tx) => tx`delete from consents`)).rejects.toThrow(
      /permission denied/
    );
  });

  it('alex_prompts are visible to the admin role only, in tenant context', async () => {
    const asAdmin = (await asApp(
      'app',
      { tenant: A, role: 'admin' },
      (tx) => tx`select version from alex_prompts`
    )) as unknown[];
    expect(asAdmin).toHaveLength(1);
    expect(
      (await asApp(
        'app',
        { tenant: A, role: 'owner' },
        (tx) => tx`select version from alex_prompts`
      )) as unknown[]
    ).toHaveLength(0);
    expect(
      (await asApp(
        'app',
        { tenant: B, role: 'admin' },
        (tx) => tx`select version from alex_prompts`
      )) as unknown[]
    ).toHaveLength(0);
  });

  it('webhook_events: the web role can insert but not read; the worker can read all', async () => {
    await asApp(
      'app',
      {},
      (tx) =>
        tx`insert into webhook_events (source, external_id, payload) values ('cal', 'e1', '{}')`
    );
    await expect(asApp('app', {}, (tx) => tx`select * from webhook_events`)).rejects.toThrow(
      /permission denied/
    );
    expect(
      (await asApp('worker', {}, (tx) => tx`select * from webhook_events`)) as unknown[]
    ).toHaveLength(2);
  });

  it("the worker's due-run scan is cross-tenant; the web role is tenant scoped", async () => {
    const [auto] = await db.admin`select id from automations where tenant_id = ${A}`;
    await db.admin`insert into automation_runs (tenant_id, automation_id, contact_id, next_run_at) values (${A}, ${auto.id}, ${contactA}, now())`;
    expect(
      (await asApp(
        'worker',
        {},
        (tx) => tx`select id from automation_runs where status = 'active'`
      )) as unknown[]
    ).toHaveLength(1);
    expect(
      (await asApp('app', { tenant: B }, (tx) => tx`select id from automation_runs`)) as unknown[]
    ).toHaveLength(0);
  });

  it('tenant A cannot read tenant B calls or service tokens, with or without context', async () => {
    await db.admin`insert into service_tokens (tenant_id, prefix, key_hash, label) values (${B}, 'pfx_b', 'hash', 'n8n')`;
    for (const t of ['calls', 'service_tokens']) {
      const own = (await asApp('app', { tenant: A }, (tx) =>
        tx.unsafe(`select tenant_id from ${t}`)
      )) as { tenant_id: string }[];
      expect(
        own.every((r) => r.tenant_id === A),
        t
      ).toBe(true);
      expect(await db.app.unsafe(`select 1 from ${t}`), t).toHaveLength(0);
    }
  });
});
