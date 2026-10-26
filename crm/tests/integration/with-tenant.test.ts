import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { contacts } from '@/server/db/schema';
import { withPlatform } from '@/server/tenancy';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let oneConn: Db;
let oneConnClient: postgres.Sql;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  // A single-connection pool makes carry-over between units of work impossible to miss.
  const u = new URL(process.env.TEST_DATABASE_ADMIN_URL as string);
  u.pathname = `/${tdb.name}`;
  u.username = 'kynetic_app';
  u.password = 'app-test-pw';
  oneConnClient = postgres(u.toString(), { max: 1 });
  oneConn = createDb(oneConnClient);
});
afterAll(async () => {
  await oneConnClient?.end();
  await tdb?.drop();
});

describe('withTenant', () => {
  it('scopes reads to the tenant in the context', async () => {
    const rows = await withTenant(ctx.ownerA(), (tx) => tx.select().from(contacts), { db });
    expect(rows).toHaveLength(1);
    expect(rows[0].tenantId).toBe(IDS.tenantA);
    const rowsB = await withTenant(ctx.ownerB(), (tx) => tx.select().from(contacts), { db });
    expect(rowsB.map((r) => r.tenantId)).toEqual([IDS.tenantB]);
  });

  it('SEC-T-04: a pooled connection does not carry the previous tenant', async () => {
    await withTenant(
      ctx.ownerA(),
      async (tx) => {
        expect(await tx.select().from(contacts)).toHaveLength(1);
      },
      { db: oneConn }
    );
    const leaked = await oneConn.execute(
      sql`select app_tenant_id() as t, app_user_id() as u, app_role() as r, app_read_only() as ro`
    );
    expect(leaked[0]).toEqual({ t: null, u: null, r: null, ro: false });
    expect(await oneConn.select().from(contacts)).toHaveLength(0);
  });

  it('rolls back when fn throws, and leaves no context behind', async () => {
    await expect(
      withTenant(
        ctx.ownerA(),
        async (tx) => {
          await tx.execute(
            sql`insert into notifications (tenant_id, kind, title) values (${IDS.tenantA}, 'new_lead', 'temp')`
          );
          throw new Error('boom');
        },
        { db: oneConn }
      )
    ).rejects.toThrow('boom');
    const [n] = await tdb.admin`select count(*)::int as n from notifications where title = 'temp'`;
    expect(n.n).toBe(0);
    const ctxAfter = await oneConn.execute(sql`select app_tenant_id() as t`);
    expect(ctxAfter[0].t).toBeNull();
  });

  it('refuses a malformed context before running any query', async () => {
    await expect(
      withTenant({ tenantId: 'not-a-uuid', role: 'owner' }, async () => 1, { db })
    ).rejects.toThrow();
    await expect(
      withTenant({ tenantId: IDS.tenantA, role: 'root' as never }, async () => 1, { db })
    ).rejects.toThrow();
  });

  it('sets view-as context: impersonator id is visible to the database', async () => {
    const r = await withTenant(
      ctx.adminViewingA(),
      async (tx) => {
        const out = await tx.execute(sql`select app_impersonator_id() as i, app_role() as r`);
        return out[0];
      },
      { db }
    );
    expect(r).toEqual({ i: IDS.admin, r: 'admin' });
  });

  it('readOnly makes writes fail', async () => {
    await expect(
      withTenant(
        { ...ctx.ownerA(), readOnly: true },
        (tx) =>
          tx.execute(
            sql`insert into notifications (tenant_id, kind, title) values (${IDS.tenantA}, 'new_lead', 'ro')`
          ),
        { db }
      )
    ).rejects.toThrow(/row-level security|Failed query/);
  });
});

describe('withPlatform', () => {
  it('gives a Kynetic role no tenant row access of its own', async () => {
    const rows = await withPlatform(
      { userId: IDS.admin, role: 'admin' },
      (tx) => tx.select().from(contacts),
      { db }
    );
    expect(rows).toHaveLength(0);
  });

  it('rejects a client role', async () => {
    await expect(
      withPlatform({ userId: IDS.ownerA, role: 'owner' as never }, async () => 1, { db })
    ).rejects.toThrow();
  });
});
