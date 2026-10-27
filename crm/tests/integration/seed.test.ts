import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { SEED_TENANT_SLUGS, seedDemoTenants } from '../../src/server/db/seed/demo';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db?.drop();
});

const count = async (table: string) =>
  Number((await db.admin.unsafe(`select count(*)::int as n from ${table}`))[0]!.n);

describe('M0-26 reference seed (migration 0012)', () => {
  it('seeds the nine modules with only platform always on', async () => {
    const rows =
      await db.admin`select module_key, always_on from module_catalog order by module_key`;
    expect(rows).toHaveLength(9);
    expect(rows.filter((r) => r.always_on).map((r) => r.module_key)).toEqual(['platform']);
  });

  it('stores prices in cents per DATABASE.md', async () => {
    const price = async (m: string, tier: string, level = '') =>
      (
        await db.admin`select setup_cents, monthly_cents, one_time_cents from module_prices
          where module_key = ${m} and tier = ${tier} and level = ${level}`
      )[0];
    expect(await price('alex_core', 'T1')).toMatchObject({
      setup_cents: 1_000_000,
      monthly_cents: 250_000
    });
    expect(await price('alex_core', 'T3')).toMatchObject({
      setup_cents: 2_000_000,
      monthly_cents: 500_000
    });
    expect(await price('missed_call_textback', 'T2')).toMatchObject({
      setup_cents: 100_000,
      monthly_cents: 40_000
    });
    expect(await price('reactivation', 'T2')).toMatchObject({
      setup_cents: null,
      monthly_cents: null,
      one_time_cents: 600_000
    });
    expect(await price('followup_bundle', 'T3')).toMatchObject({
      setup_cents: 900_000,
      monthly_cents: 380_000
    });
    expect(await price('crm', 'ALL', 'lite')).toMatchObject({
      setup_cents: 100_000,
      monthly_cents: 50_000
    });
    expect(await price('crm', 'ALL', 'full')).toMatchObject({
      setup_cents: 200_000,
      monthly_cents: 75_000
    });
    expect(await count('module_prices')).toBe(23);
  });

  it('seeds six automation templates mapped to their modules', async () => {
    const rows = await db.admin`select key, module_key from automation_templates order by key`;
    expect(Object.fromEntries(rows.map((r) => [r.key, r.module_key]))).toEqual({
      appointment_reminders: 'alex_core',
      missed_call_textback: 'missed_call_textback',
      no_show_recovery: 'alex_core',
      quote_followup: 'quote_followup',
      reactivation: 'reactivation',
      speed_to_lead: 'alex_core'
    });
  });

  it('is idempotent and never overwrites an edited row', async () => {
    await db.admin`update module_prices set monthly_cents = 1 where module_key = 'opm' and tier = 'T1'`;
    const sqlText = readFileSync(
      fileURLToPath(new URL('../../drizzle/0012_seed_reference.sql', import.meta.url)),
      'utf8'
    ).replaceAll('--> statement-breakpoint', '');
    await db.admin.unsafe(sqlText);
    expect(await count('module_catalog')).toBe(9);
    expect(await count('module_prices')).toBe(23);
    expect(await count('automation_templates')).toBe(6);
    const [p] =
      await db.admin`select monthly_cents from module_prices where module_key = 'opm' and tier = 'T1'`;
    expect(p!.monthly_cents).toBe(1);
  });
});

describe('M0-26 synthetic demo tenants', () => {
  const tables = [
    'tenants',
    'users',
    'memberships',
    'tenant_modules',
    'contacts',
    'deals',
    'calls',
    'appointments'
  ];
  const snapshot = async () =>
    Object.fromEntries(await Promise.all(tables.map(async (t) => [t, await count(t)])));

  it('creates demo-a, demo-b and demo-sales', async () => {
    const results = await seedDemoTenants(db.admin, { now: new Date('2026-10-26T12:00:00Z') });
    expect(results.map((r) => r.slug)).toEqual([...SEED_TENANT_SLUGS]);
    expect(results.every((r) => r.status === 'created')).toBe(true);
    const slugs = await db.admin`select slug from tenants order by slug`;
    expect(slugs.map((r) => r.slug)).toEqual(['demo-a', 'demo-b', 'demo-sales']);
  });

  it('running the seed again changes nothing', async () => {
    const before = await snapshot();
    const results = await seedDemoTenants(db.admin);
    expect(results.every((r) => r.status === 'skipped')).toBe(true);
    expect(await snapshot()).toEqual(before);
  });

  it('is fully synthetic: 555-01xx phones and example.test emails only', async () => {
    const phones = await db.admin`select primary_phone_e164 as p from contacts`;
    expect(phones.length).toBeGreaterThan(40);
    for (const { p } of phones) expect(p, p).toMatch(/^\+1\d{3}55501\d{2}$/);
    const emails =
      await db.admin`select email as e from users union all select primary_email from contacts`;
    for (const { e } of emails) expect(e, e).toMatch(/@example\.test$/);
  });

  it('gives every tenant its pipeline, Alex config and platform module', async () => {
    const rows = await db.admin`select t.slug,
      (select count(*)::int from pipeline_stages s where s.tenant_id = t.id) as stages,
      (select count(*)::int from alex_configs a where a.tenant_id = t.id) as alex,
      (select enabled from tenant_modules m where m.tenant_id = t.id and m.module_key = 'platform') as platform
      from tenants t`;
    for (const r of rows) expect(r, r.slug).toMatchObject({ stages: 8, alex: 1, platform: true });
  });

  it('keeps tenants isolated for the app role', async () => {
    const [a] = await db.admin`select id from tenants where slug = 'demo-a'`;
    const seen = await db.app.begin(async (tx) => {
      await tx`select set_config('app.tenant_id', ${a!.id}, true), set_config('app.role', 'owner', true)`;
      return tx`select distinct tenant_id from contacts`;
    });
    expect(seen.map((r) => r.tenant_id)).toEqual([a!.id]);
  });
});
