import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { seedDemoTenants } from '../../src/server/db/seed/demo';
import { assertSyntheticOnly, findNonSeedTenants } from '../../src/server/preview/guard';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
});
afterAll(async () => {
  await db?.drop();
});

describe('M0-27 preview database guard', () => {
  it('passes on an empty database and after the seed', async () => {
    await expect(assertSyntheticOnly(db.admin)).resolves.toBeUndefined();
    await seedDemoTenants(db.admin);
    await expect(assertSyntheticOnly(db.admin)).resolves.toBeUndefined();
    expect(await findNonSeedTenants(db.admin)).toEqual([]);
  });

  it('refuses to start when a non-seed tenant exists, naming the slug', async () => {
    await db.admin`insert into tenants (slug, name, status, plan, pricing_tier, timezone, avg_job_value_cents)
      values ('acme-real', 'Acme Real Client', 'active', 'founding', 'T1', 'America/Denver', 100000)`;
    await expect(assertSyntheticOnly(db.admin)).rejects.toThrow(/acme-real/);
  });
});

describe('M0-27 preview.sh slug', () => {
  const script = fileURLToPath(new URL('../../deploy/preview/preview.sh', import.meta.url));
  const slug = (b: string) => execFileSync('bash', [script, 'slug', b]).toString().trim();

  it('is DNS-safe, stable and unique per branch', () => {
    const s = slug('M0/Preview_Env');
    expect(s).toMatch(/^[a-z0-9-]{1,47}$/);
    expect(slug('M0/Preview_Env')).toBe(s);
    expect(slug('m0/preview-env')).not.toBe(s);
    expect(slug('x'.repeat(120)).length).toBeLessThanOrEqual(47);
  });
});
