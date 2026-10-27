import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  changeMembershipRole,
  changeStaffRole,
  deactivateUser,
  inviteUser,
  listUsers,
  reactivateUser,
  resetClientUser,
  type StaffCaller
} from '@/server/admin';
import { getSessionUser, createAuth, type Auth } from '@/server/auth';
import { createDb } from '@/server/db/client';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

// M8a-03, F-61. Cross-tenant user management through the SECURITY DEFINER functions of migration 0031.
// The rows from TESTING.md: a deactivated user with an open session cannot sign in and the session
// ends; a VA who tries to manage an admin is refused.

let db: TestDatabase;
let auth: Auth;
const BASE = 'http://localhost:3000';
const ADMIN2 = 'cccccccc-0000-4000-8000-000000000003';
const OWNER_A2 = 'aaaaaaa3-0000-4000-8000-000000000003';

const admin: StaffCaller = { id: IDS.admin, kyneticRole: 'admin' };
const admin2: StaffCaller = { id: ADMIN2, kyneticRole: 'admin' };
const va: StaffCaller = { id: IDS.va, kyneticRole: 'va' };
const owner: StaffCaller = { id: IDS.ownerA, kyneticRole: null };
const deps = () => ({ db: createDb(db.app) });

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  await db.admin`insert into users (id, email, kynetic_role) values (${ADMIN2}, 'admin2@example.test', 'admin')`;
  await db.admin`insert into users (id, email) values (${OWNER_A2}, 'owner2@example.test')`;
  await db.admin`insert into memberships (tenant_id, user_id, role) values (${IDS.tenantA}, ${OWNER_A2}, 'owner')`;
  auth = createAuth({
    db: createDb(db.auth),
    baseUrl: BASE,
    secret: 'integration-test-secret-0123456789abcdef',
    sendMagicLink: async () => {}
  });
});
afterAll(async () => {
  await db?.drop();
});

const audit = (action: string) =>
  db.admin`select actor_user_id, tenant_id, before, after from audit_log where action = ${action} order by created_at, id`;
const sessionsOf = async (userId: string) =>
  (await db.admin`select 1 from sessions where user_id = ${userId}`).length;

async function signIn(userId: string): Promise<Headers> {
  const ctx = await auth.$context;
  const s = await ctx.internalAdapter.createSession(userId);
  const { serializeSignedCookie } = await import('better-call');
  const c = await serializeSignedCookie('better-auth.session_token', s.token, ctx.secret);
  const value = decodeURIComponent(c.split(';')[0].split('=').slice(1).join('='));
  return new Headers({ origin: BASE, cookie: `better-auth.session_token=${value}` });
}

describe('listUsers', () => {
  it('lists users and pending invites across tenants for admin and VA', async () => {
    for (const who of [admin, va]) {
      const rows = await listUsers(who, {}, deps());
      const emails = rows.map((r) => r.email);
      expect(emails).toContain('admin2@example.test');
      expect(rows.some((r) => r.tenantId === IDS.tenantA && r.membershipRole === 'owner')).toBe(
        true
      );
      expect(rows.some((r) => r.tenantId === IDS.tenantB)).toBe(true);
    }
  });

  it('filters by tenant and search, treating % and _ as literal text', async () => {
    const a = await listUsers(admin, { tenantId: IDS.tenantA }, deps());
    expect(a.every((r) => r.tenantId === IDS.tenantA)).toBe(true);
    expect(await listUsers(admin, { search: 'owner2' }, deps())).toHaveLength(1);
    expect(await listUsers(admin, { search: '%' }, deps())).toHaveLength(0);
  });

  it('refuses client users before the database', async () => {
    await expect(listUsers(owner, {}, deps())).rejects.toMatchObject({ name: 'ForbiddenError' });
  });
});

describe('inviteUser', () => {
  it('stores only a hash, delivers the raw token once and audits the invite', async () => {
    let sent: { token: string; email: string } | undefined;
    const res = await inviteUser(
      va,
      { tenantId: IDS.tenantA, email: 'New.Person@Example.test', role: 'staff' },
      { ...deps(), deliver: async (i) => void (sent = i) }
    );
    expect(res.delivered).toBe(true);
    expect(sent?.email).toBe('new.person@example.test');
    const [row] =
      await db.admin`select email, role, token_hash, invited_by, expires_at from invitations where id = ${res.invitationId}`;
    expect(row.email).toBe('new.person@example.test');
    expect(row.invited_by).toBe(IDS.va);
    expect(row.token_hash).not.toContain(sent!.token);
    expect(row.token_hash).toHaveLength(64);
    const days = (row.expires_at.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
    const rows = await audit('user.invite');
    expect(rows.at(-1)).toMatchObject({ actor_user_id: IDS.va, tenant_id: IDS.tenantA });
    expect(JSON.stringify(rows.at(-1))).not.toContain('new.person');
  });

  it('replaces an earlier pending invite for the same email and tenant', async () => {
    const first = await inviteUser(
      admin,
      { tenantId: IDS.tenantA, email: 'twice@example.test', role: 'staff' },
      deps()
    );
    const second = await inviteUser(
      admin,
      { tenantId: IDS.tenantA, email: 'twice@example.test', role: 'owner' },
      deps()
    );
    const [a] = await db.admin`select revoked_at from invitations where id = ${first.invitationId}`;
    const [b] =
      await db.admin`select revoked_at from invitations where id = ${second.invitationId}`;
    expect(a.revoked_at).not.toBeNull();
    expect(b.revoked_at).toBeNull();
    const listed = (await listUsers(admin, { search: 'twice@' }, deps())).filter(
      (r) => r.status === 'invited'
    );
    expect(listed).toHaveLength(1);
    expect(listed[0].membershipRole).toBe('owner');
  });

  it('refuses existing members, Kynetic staff and unknown tenants; a client user cannot invite', async () => {
    await expect(
      inviteUser(
        admin,
        { tenantId: IDS.tenantA, email: 'owner2@example.test', role: 'staff' },
        deps()
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      inviteUser(
        admin,
        { tenantId: IDS.tenantA, email: 'admin2@example.test', role: 'staff' },
        deps()
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      inviteUser(
        admin,
        {
          tenantId: 'dddddddd-0000-4000-8000-000000000000',
          email: 'x@example.test',
          role: 'staff'
        },
        deps()
      )
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      inviteUser(owner, { tenantId: IDS.tenantA, email: 'y@example.test', role: 'staff' }, deps())
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });

  it('rejects a bad email or role as a validation error', async () => {
    await expect(
      inviteUser(admin, { tenantId: IDS.tenantA, email: 'nope', role: 'staff' }, deps())
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      inviteUser(
        admin,
        { tenantId: IDS.tenantA, email: 'z@example.test', role: 'admin' as 'staff' },
        deps()
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});

describe('deactivateUser', () => {
  it('ends every session, blocks the next request, revokes invites and audits (SEC-T-09)', async () => {
    const headers = await signIn(IDS.staffA);
    await signIn(IDS.staffA);
    expect(await sessionsOf(IDS.staffA)).toBe(2);
    expect(await getSessionUser(headers, { auth, db: createDb(db.auth) })).not.toBeNull();
    await db.admin`insert into invitations (tenant_id, email, role, token_hash, expires_at)
      select ${IDS.tenantA}, email, 'staff', 'hash-staffA', now() + interval '1 day' from users where id = ${IDS.staffA}`;

    await deactivateUser(admin, IDS.staffA, deps());

    expect(await sessionsOf(IDS.staffA)).toBe(0);
    expect(await getSessionUser(headers, { auth, db: createDb(db.auth) })).toBeNull();
    const [u] = await db.admin`select disabled_at from users where id = ${IDS.staffA}`;
    expect(u.disabled_at).not.toBeNull();
    const [inv] =
      await db.admin`select revoked_at from invitations where token_hash = 'hash-staffA'`;
    expect(inv.revoked_at).not.toBeNull();
    const row = (await audit('user.deactivate')).at(-1)!;
    expect(row.actor_user_id).toBe(IDS.admin);
    expect(row.after).toMatchObject({ disabled: true, sessions_revoked: 2, invites_revoked: 1 });
  });

  it('refuses a VA, a client user and your own account', async () => {
    await expect(deactivateUser(va, IDS.ownerB, deps())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    await expect(deactivateUser(owner, IDS.ownerB, deps())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    await expect(deactivateUser(admin, IDS.admin, deps())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    const [u] = await db.admin`select disabled_at from users where id = ${IDS.ownerB}`;
    expect(u.disabled_at).toBeNull();
  });

  it('a VA cannot manage an admin by any route', async () => {
    await expect(deactivateUser(va, ADMIN2, deps())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    await expect(changeStaffRole(va, { userId: ADMIN2, role: 'va' }, deps())).rejects.toMatchObject(
      { name: 'ForbiddenError' }
    );
    await expect(resetClientUser(va, ADMIN2, deps())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
    const [u] = await db.admin`select kynetic_role, disabled_at from users where id = ${ADMIN2}`;
    expect(u).toMatchObject({ kynetic_role: 'admin', disabled_at: null });
  });

  it('the database refuses a forged role claim even if the application check is skipped', async () => {
    // A VA connection that claims the admin role: no matching active admin row for that user.
    await expect(
      deactivateUser({ id: IDS.va, kyneticRole: 'admin' }, IDS.ownerB, deps())
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    // The application check is bypassed here by calling the function directly as a VA.
    await expect(
      createDb(db.app).transaction(async (tx) => {
        const { sql } = await import('drizzle-orm');
        await tx.execute(
          sql`select set_config('app.user_id', ${IDS.va}, true), set_config('app.role', 'va', true)`
        );
        await tx.execute(sql`select admin_deactivate_user(${IDS.ownerB}::uuid)`);
      })
    ).rejects.toThrow();
  });

  it('reactivation restores sign-in and is audited', async () => {
    await reactivateUser(admin, IDS.staffA, deps());
    const [u] = await db.admin`select disabled_at from users where id = ${IDS.staffA}`;
    expect(u.disabled_at).toBeNull();
    expect(await audit('user.reactivate')).toHaveLength(1);
    await expect(reactivateUser(va, IDS.staffA, deps())).rejects.toMatchObject({
      name: 'ForbiddenError'
    });
  });
});

describe('resetClientUser', () => {
  it('signs a client user out everywhere, audits, then notifies', async () => {
    await signIn(IDS.ownerB);
    const notified: string[] = [];
    await resetClientUser(va, IDS.ownerB, {
      ...deps(),
      notify: async (id) => void notified.push(id)
    });
    expect(await sessionsOf(IDS.ownerB)).toBe(0);
    expect(notified).toEqual([IDS.ownerB]);
    const row = (await audit('user.reset')).at(-1)!;
    expect(row.actor_user_id).toBe(IDS.va);
    expect(row.after).toMatchObject({ sessions_revoked: 1 });
  });

  it('does not notify when the reset is refused, and refuses unknown users', async () => {
    const notified: string[] = [];
    await expect(
      resetClientUser(owner, IDS.ownerB, {
        ...deps(),
        notify: async (id) => void notified.push(id)
      })
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    await expect(
      resetClientUser(admin, 'dddddddd-0000-4000-8000-000000000000', deps())
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(notified).toEqual([]);
  });
});

describe('changeMembershipRole', () => {
  it('changes a role, audits with before and after, and keeps one owner', async () => {
    await changeMembershipRole(
      admin,
      { tenantId: IDS.tenantA, userId: OWNER_A2, role: 'staff' },
      deps()
    );
    const row = (await audit('user.membership_role')).at(-1)!;
    expect(row).toMatchObject({
      tenant_id: IDS.tenantA,
      before: { role: 'owner' },
      after: { role: 'staff' }
    });
    // ownerA is now the only owner of tenant A.
    await expect(
      changeMembershipRole(
        admin,
        { tenantId: IDS.tenantA, userId: IDS.ownerA, role: 'staff' },
        deps()
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    await expect(
      changeMembershipRole(va, { tenantId: IDS.tenantA, userId: OWNER_A2, role: 'owner' }, deps())
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
  });
});

describe('changeStaffRole', () => {
  it('changes a Kynetic role, signs the target out, and never your own account', async () => {
    await signIn(ADMIN2);
    await changeStaffRole(admin, { userId: ADMIN2, role: 'va' }, deps());
    const [u] = await db.admin`select kynetic_role from users where id = ${ADMIN2}`;
    expect(u.kynetic_role).toBe('va');
    expect(await sessionsOf(ADMIN2)).toBe(0);
    await changeStaffRole(admin, { userId: ADMIN2, role: 'admin' }, deps());
    await expect(
      changeStaffRole(admin, { userId: IDS.admin, role: 'va' }, deps())
    ).rejects.toMatchObject({ name: 'ForbiddenError' });
    await expect(
      changeStaffRole(admin2, { userId: IDS.admin, role: null }, deps())
    ).resolves.toBeUndefined();
    const [a] = await db.admin`select kynetic_role from users where id = ${IDS.admin}`;
    expect(a.kynetic_role).toBeNull();
  });
});
