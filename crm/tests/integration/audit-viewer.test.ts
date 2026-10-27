import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { listTenantOptions, searchAuditLog } from '@/server/admin';
import { createDb, type Db } from '@/server/db/client';
import { withTenant } from '@/server/tenancy';
import { audit } from '@/server/audit';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
const admin = { userId: IDS.admin, role: 'admin' as const };
const va = { userId: IDS.va, role: 'va' as const };

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  await withTenant(
    ctx.ownerA(),
    (tx) => audit(tx, { action: 'contact.update', entity: 'contact' }),
    {
      db
    }
  );
  await withTenant(ctx.ownerA(), (tx) => audit(tx, { action: 'export.csv', entity: 'contact' }), {
    db
  });
  await withTenant(
    ctx.ownerB(),
    (tx) => audit(tx, { action: 'contact.update', entity: 'contact' }),
    {
      db
    }
  );
});
afterAll(async () => {
  await tdb?.drop();
});

describe('M8a-05 audit log viewer (F-60)', () => {
  it('filters by tenant', async () => {
    const r = await searchAuditLog(admin, { tenant: IDS.tenantA }, { db });
    // The seed may add its own rows for the tenant; the two written here must be among them.
    expect(r.rows.map((x) => x.action)).toEqual(
      expect.arrayContaining(['contact.update', 'export.csv'])
    );
    expect(r.rows.every((x) => x.tenantId === IDS.tenantA)).toBe(true);
  });

  it('filters by user', async () => {
    const r = await searchAuditLog(admin, { actor: IDS.ownerB }, { db });
    expect(r.rows.length).toBe(1);
    expect(r.rows[0]?.actorUserId).toBe(IDS.ownerB);
  });

  it('filters by action and combines filters', async () => {
    const all = await searchAuditLog(admin, { action: 'contact.update' }, { db });
    expect(all.rows.length).toBe(2);
    const one = await searchAuditLog(
      admin,
      { action: 'contact.update', tenant: IDS.tenantB },
      { db }
    );
    expect(one.rows.length).toBe(1);
  });

  it('filters by date range, the end day included', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const inRange = await searchAuditLog(
      admin,
      { from: today, to: today, tenant: IDS.tenantA },
      { db }
    );
    expect(inRange.rows.map((x) => x.action)).toContain('export.csv');
    const past = await searchAuditLog(admin, { to: '2020-01-01' }, { db });
    expect(past.rows.length).toBe(0);
  });

  it('pages with a next-page flag', async () => {
    const r = await searchAuditLog(admin, { page: 2 }, { db });
    expect(r.page).toBe(2);
    expect(r.rows.length).toBe(0);
    expect(r.hasNext).toBe(false);
  });

  it('VA can read the log and the tenant list (SECURITY 2.2)', async () => {
    const r = await searchAuditLog(va, { tenant: IDS.tenantA, action: 'export.csv' }, { db });
    expect(r.rows.length).toBe(1);
    expect((await listTenantOptions(va, { db })).map((t) => t.id)).toContain(IDS.tenantA);
  });

  it('a client role is refused, by the app and by the database', async () => {
    await expect(
      searchAuditLog({ userId: IDS.ownerA, role: 'owner' as never }, {}, { db })
    ).rejects.toThrow(/staff only/);
    // Bypassing the app check: the function itself raises 42501 for a client session.
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          (await import('drizzle-orm'))
            .sql`select set_config('app.role', 'owner', true), set_config('app.tenant_id', ${IDS.tenantA}, true)`
        );
        await tx.execute((await import('drizzle-orm')).sql`select * from audit_search()`);
      })
    ).rejects.toThrow();
  });

  it('the web role cannot read audit_log directly', async () => {
    await expect(tdb.app`select * from audit_log`).rejects.toThrow(/permission denied/);
  });
});
