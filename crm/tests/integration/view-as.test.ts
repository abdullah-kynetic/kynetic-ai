import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { audit } from '@/server/audit';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createDb, type Db } from '@/server/db/client';
import * as impersonation from '@/server/impersonation';
import {
  endViewAs,
  listViewAsTenants,
  resolveViewAs,
  startViewAs,
  VIEW_AS,
  withViewAs,
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
  it('lets the admin role start with no reason and still audits it (DC-125)', async () => {
    const { sessionId } = await startViewAs(
      { user: admin, tenantId: IDS.tenantA, reason: '' },
      { db, now: T0 }
    );
    const [row] =
      await tdb.admin`select reason from impersonation_sessions where id = ${sessionId}`;
    expect(row.reason).toBeNull();
    expect((await auditRows('viewas.start', sessionId))[0]).toMatchObject({
      actor_user_id: IDS.admin,
      impersonator_user_id: IDS.admin
    });
    await expect(
      startViewAs({ user: admin, tenantId: IDS.tenantB, reason: 'short' }, { db, now: T0 })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });

  it('needs a reason and records the session with tenant, impersonator, ip and reason', async () => {
    await expect(
      startViewAs({ user: admin, tenantId: IDS.tenantA, reason: 'short' }, { db, now: T0 })
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });

    await expect(
      startViewAs({ user: va, tenantId: IDS.tenantA, reason: '' }, { db, now: T0 })
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

  it('blocks writes at the database', async () => {
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

  it('ends 30 minutes after the start, however active, and logs the stop', async () => {
    const { sessionId, cookie } = await start(admin);
    // Constant use does not extend it: every request up to the last second still works...
    for (const ms of [60_000, 10 * 60_000, 20 * 60_000, VIEW_AS.maxMs - 1000]) {
      const s = await resolveViewAs({ user: admin, cookie }, { db, now: at(ms) });
      expect(s.kind).toBe('active');
      if (s.kind === 'active') expect(s.expiresAt.getTime()).toBe(T0.getTime() + VIEW_AS.maxMs);
    }
    // ...and the next request after the 30 minutes ends it and writes the audit row.
    const s = await resolveViewAs({ user: admin, cookie }, { db, now: at(VIEW_AS.maxMs + 1000) });
    expect(s.kind).toBe('none');
    const [row] =
      await tdb.admin`select ended_at, ended_reason from impersonation_sessions where id = ${sessionId}`;
    expect(row.ended_reason).toBe('expired');
    expect(row.ended_at).not.toBeNull();
    const [stop] = await auditRows('viewas.end', sessionId);
    expect(stop.after).toMatchObject({ reason: 'expired' });
    expect(stop).toMatchObject({ tenant_id: IDS.tenantA, impersonator_user_id: IDS.admin });
    // It cannot be revived, and a second look does not log a second stop.
    expect(
      (await resolveViewAs({ user: admin, cookie }, { db, now: at(VIEW_AS.maxMs + 2000) })).kind
    ).toBe('none');
    expect(await auditRows('viewas.end', sessionId)).toHaveLength(1);
  });

  it('exit ends the session once and is safe to repeat', async () => {
    const { sessionId, cookie } = await start(admin);
    expect(await endViewAs({ user: admin, cookie }, { db, now: at(5000) })).toBe(true);
    expect(await endViewAs({ user: admin, cookie }, { db, now: at(6000) })).toBe(false);
    expect((await resolveViewAs({ user: admin, cookie }, { db, now: at(7000) })).kind).toBe('none');
    expect(await auditRows('viewas.end', sessionId)).toHaveLength(1);
  });
});

describe('READ ONLY transaction (SECURITY 2.6)', () => {
  it('makes update, delete and insert raise while read-only, and allows reads', async () => {
    const { cookie } = await start(admin);
    const s = await resolveViewAs({ user: admin, cookie }, { db, now: T0 });
    if (s.kind !== 'active') throw new Error('expected active');
    const run = (q: string) => withViewAs(s, (tx) => tx.execute(q as never), { db });
    await expect(
      run(`update tasks set title = 'x' where tenant_id = '${IDS.tenantA}'`)
    ).rejects.toMatchObject({ cause: { code: '25006' } });
    await expect(run(`delete from tasks where tenant_id = '${IDS.tenantA}'`)).rejects.toMatchObject(
      { cause: { code: '25006' } }
    );
    await expect(
      run(`insert into tasks (tenant_id, title) values ('${IDS.tenantA}', 'x')`)
    ).rejects.toMatchObject({ cause: { code: '25006' } });
    expect(await run(`select id from tasks`)).toHaveLength(1);
    const [t] = await tdb.admin`select title from tasks where tenant_id = ${IDS.tenantA}`;
    expect(t.title).not.toBe('x');
  });
});

describe('no write mode (read-only, no override)', () => {
  it('exports no way to switch writes on', () => {
    expect(Object.keys(impersonation).filter((k) => /write/i.test(k))).toEqual([]);
    const actions = readFileSync(join(process.cwd(), 'src/app/view-as/actions.ts'), 'utf8');
    expect(actions).not.toMatch(/(enable|disable)Write/i);
  });

  it('rejects writes even when a reason is supplied and the stored row says write', async () => {
    const { sessionId, cookie } = await start(admin);
    // Simulate everything the old write mode stored: a reason, a window, read_only = false.
    await tdb.admin`update impersonation_sessions
      set read_only = false, write_reason = 'Fixing the stage the owner mis-set',
          write_until = ${at(60 * 60_000).toISOString()}
      where id = ${sessionId}`;
    const s = await resolveViewAs({ user: admin, cookie }, { db, now: at(1000) });
    if (s.kind !== 'active') throw new Error('expected active');
    expect(s.readOnly).toBe(true);
    expect(s.ctx.readOnly).toBe(true);
    const run = (q: string) => withViewAs(s, (tx) => tx.execute(q as never), { db });
    for (const sql of [
      `update tasks set title = 'Support edit' where tenant_id = '${IDS.tenantA}'`,
      `delete from tasks where tenant_id = '${IDS.tenantA}'`,
      `insert into tasks (tenant_id, title) values ('${IDS.tenantA}', 'x')`
    ])
      await expect(run(sql)).rejects.toMatchObject({ cause: { code: '25006' } });
    // Even outside withViewAs, the session context alone blocks writes through row-level security.
    expect(
      await withTenant(
        s.ctx,
        (tx) =>
          tx.execute(
            `update tasks set title = 'Support edit' where tenant_id = '${IDS.tenantA}' returning id` as never
          ),
        { db }
      )
    ).toHaveLength(0);
    const [t] = await tdb.admin`select title from tasks where tenant_id = ${IDS.tenantA}`;
    expect(t.title).toBe('Call back');
  });
});

describe('no message to the client (email, SMS, notification, webhook)', () => {
  const count = async () => {
    const [m] = await tdb.admin`select count(*)::int as n from messages`;
    const [n] = await tdb.admin`select count(*)::int as n from notifications`;
    const [w] = await tdb.admin`select count(*)::int as n from webhook_events`;
    return { messages: m.n, notifications: n.n, webhooks: w.n };
  };

  it('start, requests, stop and expiry create no messages, notifications or webhook events', async () => {
    const before = await count();
    const one = await start(admin);
    await resolveViewAs({ user: admin, cookie: one.cookie }, { db, now: at(1000) });
    await endViewAs({ user: admin, cookie: one.cookie }, { db, now: at(2000) });
    const two = await start(admin);
    await resolveViewAs({ user: admin, cookie: two.cookie }, { db, now: at(VIEW_AS.maxMs + 1000) });
    expect(await count()).toEqual(before);
  });

  it('the view-as code does not import any sender, queue, notification or webhook module', () => {
    const files = [
      ...readdirSync(join(process.cwd(), 'src/server/impersonation')).map((f) =>
        join('src/server/impersonation', f)
      ),
      'src/app/view-as/actions.ts',
      'src/app/view-as/exit/route.ts',
      'src/app/view-as/expired/route.ts',
      'src/components/view-as/view-as-banner.tsx',
      'src/components/workspace/workspace-switcher.tsx'
    ];
    const banned =
      /from\s+['"][^'"]*(adapters|messaging|notifications|webhook|jobs|queue|mailer|twilio|resend)[^'"]*['"]/i;
    for (const file of files)
      expect(readFileSync(join(process.cwd(), file), 'utf8'), file).not.toMatch(banned);
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
