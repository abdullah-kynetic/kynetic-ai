import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { audit } from '@/server/audit';
import { createDb, type Db } from '@/server/db/client';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;

beforeAll(async () => {
  tdb = await createTestDatabase();
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
});
afterAll(async () => {
  await tdb?.drop();
});

// The runtime role cannot read audit_log (reads go through audit_search), so assert as superuser.
const rows = (action: string) => tdb.admin`select * from audit_log where action = ${action}`;

describe('audit helper (F-60)', () => {
  it('writes one row with before and after, taking actor and tenant from the session', async () => {
    await withTenant(
      ctx.ownerA(),
      (tx) =>
        audit(tx, {
          action: 'contact.update',
          entity: 'contact',
          entityId: 'c-1',
          before: { name: 'Old' },
          after: { name: 'New' },
          ip: '203.0.113.7',
          userAgent: 'vitest'
        }),
      { db }
    );
    const r = await rows('contact.update');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      tenant_id: IDS.tenantA,
      actor_user_id: IDS.ownerA,
      impersonator_user_id: null,
      entity: 'contact',
      entity_id: 'c-1',
      before: { name: 'Old' },
      after: { name: 'New' },
      ip: '203.0.113.7',
      user_agent: 'vitest'
    });
  });

  it('stamps the impersonator during view-as (F-57)', async () => {
    await withTenant(
      ctx.adminViewingA(),
      (tx) => audit(tx, { action: 'view_as.write', entity: 'contact' }),
      { db }
    );
    const r = await rows('view_as.write');
    expect(r[0]).toMatchObject({ tenant_id: IDS.tenantA, impersonator_user_id: IDS.admin });
    expect(r[0].before).toBeNull();
    expect(r[0].after).toBeNull();
  });

  it('writes a NULL-tenant row when there is no tenant context', async () => {
    await db.transaction(async (tx) => audit(tx, { action: 'auth.login', entity: 'user' }));
    const r = await rows('auth.login');
    expect(r[0].tenant_id).toBeNull();
  });

  it('rolls back with the surrounding write', async () => {
    await expect(
      withTenant(
        ctx.ownerA(),
        async (tx) => {
          await audit(tx, { action: 'rollback.check', entity: 'x' });
          throw new Error('boom');
        },
        { db }
      )
    ).rejects.toThrow('boom');
    expect(await rows('rollback.check')).toHaveLength(0);
  });

  it('rejects malformed input before writing', async () => {
    await expect(
      withTenant(ctx.ownerA(), (tx) => audit(tx, { action: '', entity: 'x' }), { db })
    ).rejects.toThrow();
    await expect(
      withTenant(ctx.ownerA(), (tx) => audit(tx, { action: 'a', entity: 'x', ip: 'nope' }), {
        db
      })
    ).rejects.toThrow();
  });

  it('SEC-T-35: the app role can insert but not read, update or delete audit rows', async () => {
    await withTenant(ctx.ownerA(), (tx) => audit(tx, { action: 'sec.t35', entity: 'x' }), { db });
    await expect(tdb.app`select * from audit_log`).rejects.toThrow(/permission denied/);
    await expect(tdb.app`update audit_log set action = 'x'`).rejects.toThrow(/permission denied/);
    await expect(tdb.app`delete from audit_log`).rejects.toThrow(/permission denied/);
    for (const sql of [tdb.owner, tdb.admin]) {
      await expect(sql`update audit_log set action = 'x'`).rejects.toThrow(/append-only/);
      await expect(sql`delete from audit_log`).rejects.toThrow(/append-only/);
    }
  });

  it('refuses a row naming another tenant (DC-053)', async () => {
    await expect(
      tdb.app.begin(async (sql) => {
        await sql`select set_config('app.tenant_id', ${IDS.tenantA}, true)`;
        await sql`insert into audit_log (tenant_id, action, entity) values (${IDS.tenantB}, 'x', 'y')`;
      })
    ).rejects.toThrow(/row-level security/);
  });
});
