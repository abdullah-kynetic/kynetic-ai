import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { audit } from '@/server/audit';
import { createDb, type Db } from '@/server/db/client';
import {
  disableWriteMode,
  enableWriteMode,
  endViewAs,
  listViewAsTenants,
  resolveViewAs,
  startViewAs,
  VIEW_AS,
  type ViewAsUser
} from '@/server/impersonation';
import { withTenant } from '@/server/tenancy';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
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

const admin: ViewAsUser = { id: IDS.admin, kyneticRole: 'admin', twoFactor: 'verified' };
const va: ViewAsUser = { id: IDS.va, kyneticRole: 'va', twoFactor: 'verified' };
const reason = 'Checking the booking the owner reported';
const T0 = new Date('2026-10-26T12:00:00Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

const auditRows = (action: string, sessionId?: string) =>
  sessionId
    ? tdb.admin`select * from audit_log where action = ${action} and entity_id = ${sessionId}`
    : tdb.admin`select * from audit_log where action = ${action}`;

async function start(user: ViewAsUser, tenantId: string = IDS.tenantA, now = T0) {
  return startViewAs(
    { user, tenantId, reason, meta: { ip: '203.0.113.9', userAgent: 'vitest' } },
    { db, now }
  );
}

describe('start (F-57)', () => {
  it('needs a reason and records the session with tenant, impersonator, ip and reason', async () => {
    await expect(
      startViewAs({ user: admin, tenantId: IDS.tenantA, reason: 'short' }, { db, now: T0 })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    const { sessionId, cookie } = await start(admin);
    expect(cookie).toBe(`${sessionId}.${IDS.tenantA}`);
    const [row] = await tdb.admin`select * from impersonation_sessions where id = ${sessionId}`;
    expect(row).toMatchObject({
      tenant_id: IDS.tenantA,
      impersonator_user_id: IDS.admin,
      read_only: true,
      reason,
      ip: '203.0.113.9',
      ended_at: null
    });
    const [a] = await auditRows('viewas.start', sessionId);
    expect(a).toMatchObject({
      tenant_id: IDS.tenantA,
      actor_user_id: IDS.admin,
      impersonator_user_id: IDS.admin
    });
  });

  it('refuses people without a Kynetic role or without TOTP, and unknown tenants', async () => {
    const owner: ViewAsUser = { id: IDS.ownerA, kyneticRole: null, twoFactor: 'not_required' };
    await expect(start(owner)).rejects.toMatchObject({ name: 'ForbiddenError' });
    await expect(start({ ...admin, twoFactor: 'challenge' })).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    await expect(start(admin, '33333333-3333-4333-8333-333333333333')).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });

  it('does not nest: a second start with a live session cookie is refused', async () => {
    const first = await start(admin);
    await expect(
      startViewAs(
        { user: admin, tenantId: IDS.tenantB, reason, activeCookie: first.cookie },
        { db, now: T0 }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('limits starts to 20 per hour per user and audits the refusal', async () => {
    const user: ViewAsUser = { id: IDS.va, kyneticRole: 'va', twoFactor: 'verified' };
    const now = at(2 * 3600_000);
    let refused: unknown;
    for (let i = 0; i < 25 && !refused; i++)
      await start(user, IDS.tenantA, now).catch((e) => (refused = e));
    expect(refused).toMatchObject({ code: 'RATE_LIMITED' });
    expect((await auditRows('viewas.rate_limited')).length).toBeGreaterThan(0);
  });
});

describe('resolve, read-only and audit', () => {
  it('returns the tenant context read-only and writes one audit row per request, both ids stamped', async () => {
    const { sessionId, cookie } = await start(admin);
    const state = await resolveViewAs({ user: admin, cookie }, { db, now: at(1000) });
    expect(state).toMatchObject({
      kind: 'active',
      tenantId: IDS.tenantA,
      tenantName: 'Tenant A',
      readOnly: true
    });
    if (state.kind !== 'active') return;
    expect(state.ctx).toMatchObject({
      tenantId: IDS.tenantA,
      userId: IDS.admin,
      role: 'admin',
      impersonatorId: IDS.admin,
      readOnly: true
    });
    await resolveViewAs({ user: admin, cookie }, { db, now: at(2000) });
    const rows = await auditRows('viewas.request', sessionId);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ tenant_id: IDS.tenantA, impersonator_user_id: IDS.admin });
  });

  it('blocks writes at the database in read-only, and stamps the impersonator when write mode is on', async () => {
    const { cookie } = await start(admin);
    const ro = await resolveViewAs({ user: admin, cookie }, { db, now: T0 });
    if (ro.kind !== 'active') throw new Error('expected active');
    // Inserts fail at the RLS check.
    await expect(
      withTenant(
        ro.ctx,
        (tx) =>
          tx.execute(
            `insert into tasks (tenant_id, title) values ('${IDS.tenantA}', 'x')` as never
          ),
        { db }
      )
    ).rejects.toThrow();
    await expect(
      withTenant(ro.ctx, (tx) => audit(tx, { action: 'view_as.write', entity: 'task' }), {
        db
      }).then(() => 'ok')
    ).resolves.toBe('ok'); // audit is a separate, always-allowed append; the data write above is what is refused
    // Updates and deletes match no rows.
    const updated = await withTenant(
      ro.ctx,
      (tx) =>
        tx.execute(
          `update tasks set title = 'changed' where tenant_id = '${IDS.tenantA}' returning id` as never
        ),
      { db }
    );
    expect(updated).toHaveLength(0);
    const [t] = await tdb.admin`select title from tasks where tenant_id = ${IDS.tenantA}`;
    expect(t.title).toBe('Call back');
  });

  it('only sees the viewed tenant (tenant B is invisible during a view of A)', async () => {
    const { cookie } = await start(admin);
    const s = await resolveViewAs({ user: admin, cookie }, { db, now: T0 });
    if (s.kind !== 'active') throw new Error('expected active');
    const rows = await withTenant(
      s.ctx,
      (tx) => tx.execute(`select tenant_id from contacts` as never),
      { db }
    );
    expect(new Set(rows.map((r) => r.tenant_id))).toEqual(new Set([IDS.tenantA]));
  });

  it('ignores a forged cookie: wrong tenant, another user, random ids', async () => {
    const { sessionId, cookie } = await start(admin);
    expect(
      (await resolveViewAs({ user: admin, cookie: `${sessionId}.${IDS.tenantB}` }, { db, now: T0 }))
        .kind
    ).toBe('none');
    expect((await resolveViewAs({ user: va, cookie }, { db, now: T0 })).kind).toBe('none');
    // A copied cookie must not end the owner's session either.
    expect(await endViewAs({ user: va, cookie }, { db, now: T0 })).toBe(false);
    expect((await resolveViewAs({ user: admin, cookie }, { db, now: T0 })).kind).toBe('active');
  });

  it('ends after 30 idle minutes and logs the end', async () => {
    const { sessionId, cookie } = await start(admin);
    const s = await resolveViewAs({ user: admin, cookie }, { db, now: at(VIEW_AS.idleMs + 1000) });
    expect(s.kind).toBe('none');
    const [row] =
      await tdb.admin`select ended_at, ended_reason from impersonation_sessions where id = ${sessionId}`;
    expect(row.ended_reason).toBe('idle');
    expect((await auditRows('viewas.end', sessionId))[0].after).toMatchObject({ reason: 'idle' });
  });

  it('exit ends the session once and is safe to repeat', async () => {
    const { sessionId, cookie } = await start(admin);
    expect(await endViewAs({ user: admin, cookie }, { db, now: at(5000) })).toBe(true);
    expect(await endViewAs({ user: admin, cookie }, { db, now: at(6000) })).toBe(false);
    expect((await resolveViewAs({ user: admin, cookie }, { db, now: at(7000) })).kind).toBe('none');
    expect(await auditRows('viewas.end', sessionId)).toHaveLength(1);
  });
});

describe('write mode (admin only, reason, 30 minutes)', () => {
  it('lets an admin write inside the window with the impersonator stamped, then drops back to read-only', async () => {
    const { sessionId, cookie } = await start(admin);
    await expect(
      enableWriteMode({ user: admin, cookie, reason: 'no' }, { db, now: T0 })
    ).rejects.toMatchObject({
      code: 'VALIDATION_FAILED'
    });
    const { writeUntil } = await enableWriteMode(
      { user: admin, cookie, reason: 'Fixing the stage the owner mis-set' },
      { db, now: T0 }
    );
    expect(writeUntil.getTime()).toBe(T0.getTime() + VIEW_AS.writeMs);

    const rw = await resolveViewAs({ user: admin, cookie }, { db, now: at(60_000) });
    if (rw.kind !== 'active') throw new Error('expected active');
    expect(rw.readOnly).toBe(false);
    await withTenant(
      rw.ctx,
      async (tx) => {
        await tx.execute(
          `update tasks set title = 'Edited by support' where tenant_id = '${IDS.tenantA}'` as never
        );
        await audit(tx, { action: 'task.update', entity: 'task' });
      },
      { db }
    );
    const [a] = await auditRows('task.update');
    expect(a).toMatchObject({ tenant_id: IDS.tenantA, impersonator_user_id: IDS.admin });
    expect(await auditRows('viewas.write_enable', sessionId)).toHaveLength(1);

    // A second enable inside the window is refused; after it, the session is read-only again.
    await expect(
      enableWriteMode({ user: admin, cookie, reason }, { db, now: at(120_000) })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const lapsed = await resolveViewAs(
      { user: admin, cookie },
      { db, now: at(VIEW_AS.writeMs + 1000) }
    );
    expect(lapsed).toMatchObject({ kind: 'active', readOnly: true });
    expect(await auditRows('viewas.write_expired', sessionId)).toHaveLength(1);
  });

  it('refuses a VA and audits the attempt', async () => {
    const { sessionId, cookie } = await start(va, IDS.tenantA, at(10 * 3600_000));
    await expect(
      enableWriteMode({ user: va, cookie, reason }, { db, now: at(10 * 3600_000) })
    ).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    expect(await auditRows('viewas.write_denied', sessionId)).toHaveLength(1);
    const s = await resolveViewAs({ user: va, cookie }, { db, now: at(10 * 3600_000 + 1000) });
    expect(s).toMatchObject({ kind: 'active', readOnly: true });
  });

  it('can be switched back to read-only early', async () => {
    const { cookie } = await start(admin);
    await enableWriteMode({ user: admin, cookie, reason }, { db, now: T0 });
    await disableWriteMode({ user: admin, cookie }, { db, now: at(1000) });
    expect(await resolveViewAs({ user: admin, cookie }, { db, now: at(2000) })).toMatchObject({
      readOnly: true
    });
  });
});

describe('table protection and listing', () => {
  it('the app role cannot delete sessions or edit who/when/why', async () => {
    const { sessionId } = await start(admin);
    await expect(
      tdb.app`delete from impersonation_sessions where id = ${sessionId}`
    ).rejects.toThrow(/permission denied/);
    await expect(
      tdb.app`update impersonation_sessions set reason = 'edited' where id = ${sessionId}`
    ).rejects.toThrow(/permission denied/);
    await expect(
      tdb.app`update impersonation_sessions set impersonator_user_id = ${IDS.va} where id = ${sessionId}`
    ).rejects.toThrow(/permission denied/);
  });

  it('lists clients for staff only, names and status', async () => {
    const list = await listViewAsTenants(admin, { db });
    expect(list.map((t) => t.name).sort()).toEqual(['Tenant A', 'Tenant B']);
    await expect(
      listViewAsTenants({ id: IDS.ownerA, kyneticRole: null, twoFactor: 'not_required' }, { db })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });
});
