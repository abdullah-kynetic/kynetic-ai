import { execFileSync } from 'node:child_process';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { seedProspectTenants } from '../../src/server/db/seed/prospects';

let db: TestDatabase;
let url: string;
beforeAll(async () => {
  db = await createTestDatabase();
  const u = new URL(process.env.TEST_DATABASE_ADMIN_URL as string);
  u.pathname = `/${db.name}`;
  url = u.toString();
  await seedProspectTenants(db.admin);
});
afterAll(async () => {
  await db?.drop();
});

const run = (...args: string[]) =>
  execFileSync('bun', ['src/server/db/seed/prospects-remove-cli.ts', ...args], {
    env: { ...process.env, DATABASE_URL_SEED: url },
    encoding: 'utf8'
  });

describe('prospects-remove-cli', () => {
  it('dry run changes nothing, apply removes only the named tenants', async () => {
    const [{ id }] = await db.admin`select id from tenants where slug = 'super-roofer'`;
    await db.admin`insert into audit_log (tenant_id, action, entity) values (${id}, 'test', 'tenant')`;
    expect(run('super-roofer', 'kitchens-alive')).toMatch(/dry run/);
    expect((await db.admin`select 1 from tenants`).length).toBe(13);
    expect(run('super-roofer', 'kitchens-alive', '--apply')).toMatch(/deleted 2/);
    const left = await db.admin`select slug from tenants`;
    expect(left).toHaveLength(11);
    expect(left.some((t) => t.slug === 'super-roofer')).toBe(false);
    expect((await db.admin`select 1 from companies`).length).toBe(11);
    expect((await db.admin`select 1 from audit_log where tenant_id = ${id}`).length).toBe(1);
  });

  it('refuses unknown slugs without changing anything', async () => {
    expect(() => run('nope', 'dr-roofing-construction', '--apply')).toThrow();
    expect((await db.admin`select 1 from tenants`).length).toBe(11);
  });
});
