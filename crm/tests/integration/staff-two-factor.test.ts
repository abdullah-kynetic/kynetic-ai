import { createOTP } from '@better-auth/utils/otp';
import { symmetricDecrypt } from 'better-auth/crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAuth,
  getSessionUser,
  requireUser,
  resetStaffTwoFactor,
  SecondFactorRequiredError,
  type Auth
} from '@/server/auth';
import { createDb } from '@/server/db/client';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let auth: Auth;
const BASE = 'http://localhost:3000';
const SECRET = 'integration-test-secret-0123456789abcdef';
const ADMIN2 = 'cccccccc-0000-4000-8000-000000000003';

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  await db.admin`insert into users (id, email, kynetic_role) values (${ADMIN2}, 'admin2@example.test', 'admin')`;
  auth = createAuth({
    db: createDb(db.auth),
    baseUrl: BASE,
    secret: SECRET,
    sendMagicLink: async () => {}
  });
});
afterAll(async () => {
  await db?.drop();
});

const authDb = () => createDb(db.auth);
const deps = () => ({ auth, db: authDb() });

/** A signed-in session as Google would leave it: a session row, no second factor yet. */
async function signIn(userId: string): Promise<Headers> {
  const ctx = await auth.$context;
  const s = await ctx.internalAdapter.createSession(userId);
  const { serializeSignedCookie } = await import('better-call');
  const c = await serializeSignedCookie('better-auth.session_token', s.token, ctx.secret);
  const value = decodeURIComponent(c.split(';')[0].split('=').slice(1).join('='));
  return new Headers({ origin: BASE, cookie: `better-auth.session_token=${value}` });
}

function cookieOf(res: Response, fallback: Headers): Headers {
  const jar = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .filter((c) => !c.endsWith('='))
    .join('; ');
  const h = new Headers(fallback);
  if (jar) h.set('cookie', jar);
  return h;
}

async function totp(userId: string, offset: number): Promise<string> {
  const [row] = await db.admin`select secret from two_factors where user_id = ${userId}`;
  const ctx = await auth.$context;
  const secret = await symmetricDecrypt({ key: ctx.secretConfig, data: row.secret });
  return createOTP(secret).hotp(Math.floor(Date.now() / 30000) + offset);
}

const events = (userId: string) =>
  db.admin`select action, after from audit_log where actor_user_id = ${userId} order by created_at, id`;

/** Enrols a staff user end to end and returns headers of the verified session plus the recovery codes. */
async function enrol(userId: string) {
  const h = await signIn(userId);
  const res = await auth.api.enableTwoFactor({ body: {}, headers: h, asResponse: true });
  const { backupCodes } = (await res.json()) as { backupCodes: string[] };
  const ok = await auth.api.verifyTOTP({
    body: { code: await totp(userId, 0) },
    headers: h,
    asResponse: true
  });
  expect(ok.status).toBe(200);
  return { headers: cookieOf(ok, h), backupCodes };
}

describe('M0-12 staff TOTP enforcement (F-98)', () => {
  it('a staff session without TOTP reaches only enrolment', async () => {
    const h = await signIn(IDS.va);
    expect(await getSessionUser(h, deps())).toMatchObject({
      kyneticRole: 'va',
      twoFactor: 'enrol'
    });
    await expect(requireUser(h, { deps: deps() })).rejects.toBeInstanceOf(
      SecondFactorRequiredError
    );
    await expect(
      requireUser(h, { allowPendingSecondFactor: true, deps: deps() })
    ).resolves.toMatchObject({
      twoFactor: 'enrol'
    });
  });

  it('client users are not asked for a second factor and cannot reach the endpoints', async () => {
    const h = await signIn(IDS.ownerA);
    expect(await getSessionUser(h, deps())).toMatchObject({ twoFactor: 'not_required' });
    await expect(requireUser(h, { deps: deps() })).resolves.toMatchObject({ id: IDS.ownerA });
    await expect(auth.api.enableTwoFactor({ body: {}, headers: h })).rejects.toMatchObject({
      status: 'FORBIDDEN'
    });
  });

  it('enrols: secret, ten recovery codes stored hashed, session verified, audited', async () => {
    const h = await signIn(IDS.admin);
    const res = await auth.api.enableTwoFactor({ body: {}, headers: h, asResponse: true });
    const body = (await res.json()) as { totpURI: string; backupCodes: string[] };
    expect(body.totpURI).toMatch(/^otpauth:\/\/totp\//);
    expect(body.backupCodes).toHaveLength(10);

    // A wrong first code does not enrol, and is logged.
    await expect(
      auth.api.verifyTOTP({ body: { code: '000000' }, headers: h })
    ).rejects.toMatchObject({
      status: 'UNAUTHORIZED'
    });
    expect((await getSessionUser(h, deps()))?.twoFactor).toBe('enrol');

    const ok = await auth.api.verifyTOTP({
      body: { code: await totp(IDS.admin, 0) },
      headers: h,
      asResponse: true
    });
    expect(ok.status).toBe(200);
    expect(await getSessionUser(cookieOf(ok, h), deps())).toMatchObject({ twoFactor: 'verified' });

    const [row] =
      await db.admin`select backup_codes, verified from two_factors where user_id = ${IDS.admin}`;
    expect(row.verified).toBe(true);
    const stored = JSON.parse(row.backup_codes) as string[];
    expect(stored).toHaveLength(10);
    for (const code of body.backupCodes) expect(row.backup_codes).not.toContain(code);
    expect(stored.every((c) => /^h1:[0-9a-f]{64}$/.test(c))).toBe(true);

    const log = (await events(IDS.admin)).map((e) => e.action);
    expect(log).toEqual(['auth.2fa_failed', 'auth.2fa_enrolled']);
  });

  it('a later sign-in is a challenge until a code passes; a reused code is refused and logged', async () => {
    const h = await signIn(IDS.admin);
    expect(await getSessionUser(h, deps())).toMatchObject({ twoFactor: 'challenge' });
    await expect(requireUser(h, { deps: deps() })).rejects.toMatchObject({ state: 'challenge' });

    // The enrolment code (offset 0) is spent. A fresh code from the next step works once.
    await expect(
      auth.api.verifyTOTP({ body: { code: await totp(IDS.admin, 0) }, headers: h })
    ).rejects.toMatchObject({ status: 'UNAUTHORIZED' });
    const next = await totp(IDS.admin, 1);
    const ok = await auth.api.verifyTOTP({ body: { code: next }, headers: h, asResponse: true });
    expect(ok.status).toBe(200);
    expect(await getSessionUser(h, deps())).toMatchObject({ twoFactor: 'verified' });

    const h2 = await signIn(IDS.admin);
    await expect(auth.api.verifyTOTP({ body: { code: next }, headers: h2 })).rejects.toMatchObject({
      status: 'UNAUTHORIZED'
    });
    expect((await getSessionUser(h2, deps()))?.twoFactor).toBe('challenge');
    const reasons = (await events(IDS.admin)).map((e) => e.after?.reason ?? e.after?.method);
    expect(reasons).toContain('reused');
  });

  it('locks after five wrong codes, even for the right code, and logs the lock', async () => {
    const { headers } = await enrol(ADMIN2);
    expect((await getSessionUser(headers, deps()))?.twoFactor).toBe('verified');
    const h = await signIn(ADMIN2);
    for (let i = 0; i < 5; i++)
      await expect(
        auth.api.verifyTOTP({ body: { code: String(100000 + i) }, headers: h })
      ).rejects.toMatchObject({ status: 'UNAUTHORIZED' });
    await expect(
      auth.api.verifyTOTP({ body: { code: await totp(ADMIN2, 1) }, headers: h })
    ).rejects.toMatchObject({ status: 'TOO_MANY_REQUESTS' });
    expect((await getSessionUser(h, deps()))?.twoFactor).toBe('challenge');
    const log = (await events(ADMIN2)).map((e) => e.action);
    expect(log).toContain('auth.2fa_locked');

    // The lock lapses by itself.
    await db.admin`update two_factors set locked_until = now() - interval '1 minute' where user_id = ${ADMIN2}`;
    const ok = await auth.api.verifyTOTP({
      body: { code: await totp(ADMIN2, 1) },
      headers: h,
      asResponse: true
    });
    expect(ok.status).toBe(200);
  });

  it('a recovery code signs in once and is then spent', async () => {
    const { backupCodes } = await enrol(IDS.va);
    const h = await signIn(IDS.va);
    const used = backupCodes[0];
    const ok = await auth.api.verifyBackupCode({
      body: { code: used },
      headers: h,
      asResponse: true
    });
    expect(ok.status).toBe(200);
    expect(await getSessionUser(h, deps())).toMatchObject({ twoFactor: 'verified' });
    const [row] = await db.admin`select backup_codes from two_factors where user_id = ${IDS.va}`;
    expect(JSON.parse(row.backup_codes)).toHaveLength(9);

    const h2 = await signIn(IDS.va);
    await expect(
      auth.api.verifyBackupCode({ body: { code: used }, headers: h2 })
    ).rejects.toMatchObject({
      status: 'UNAUTHORIZED'
    });
    expect((await getSessionUser(h2, deps()))?.twoFactor).toBe('challenge');
    const log = await events(IDS.va);
    expect(log.map((e) => e.action)).toContain('auth.2fa_recovery_used');
    expect(log.find((e) => e.action === 'auth.2fa_recovery_used')?.after).toEqual({ remaining: 9 });
  });

  it('refuses disable, secret read-back and recovery-code regeneration before verification', async () => {
    const h = await signIn(IDS.va);
    await expect(auth.api.disableTwoFactor({ body: {}, headers: h })).rejects.toMatchObject({
      status: 'FORBIDDEN'
    });
    await expect(auth.api.getTOTPURI({ body: {}, headers: h })).rejects.toMatchObject({
      status: 'FORBIDDEN'
    });
    await expect(auth.api.generateBackupCodes({ body: {}, headers: h })).rejects.toMatchObject({
      status: 'FORBIDDEN'
    });
    await expect(auth.api.enableTwoFactor({ body: {}, headers: h })).rejects.toMatchObject({
      status: 'FORBIDDEN'
    });
  });
});

describe('M0-12 reset by another admin', () => {
  it('another admin resets: secret and codes gone, sessions revoked, audited, re-enrol possible', async () => {
    const before =
      await db.admin`select count(*)::int as n from sessions where user_id = ${IDS.va}`;
    expect(before[0].n).toBeGreaterThan(0);
    const notified: string[] = [];
    await resetStaffTwoFactor({ id: IDS.admin, kyneticRole: 'admin' }, IDS.va, {
      db: createDb(db.app),
      notify: async (id) => {
        notified.push(id);
      }
    });
    expect(notified).toEqual([IDS.va]);
    const [u] = await db.admin`select two_factor_enabled from users where id = ${IDS.va}`;
    expect(u.two_factor_enabled).toBe(false);
    expect(await db.admin`select 1 from two_factors where user_id = ${IDS.va}`).toHaveLength(0);
    expect(await db.admin`select 1 from sessions where user_id = ${IDS.va}`).toHaveLength(0);
    const [a] = await db.admin`select actor_user_id, entity_id, before, after from audit_log
      where action = 'user.2fa_reset'`;
    expect(a).toMatchObject({ actor_user_id: IDS.admin, entity_id: IDS.va });
    expect(a.before).toEqual({ two_factor_enabled: true });
    expect(a.after).toMatchObject({ two_factor_enabled: false });

    const h = await signIn(IDS.va);
    expect((await getSessionUser(h, deps()))?.twoFactor).toBe('enrol');
    const { backupCodes } = await enrol(IDS.va);
    expect(backupCodes).toHaveLength(10);
  });

  it('refuses your own account, a VA caller and a client user, and changes nothing', async () => {
    const app = createDb(db.app);
    const cause = await resetStaffTwoFactor({ id: IDS.admin, kyneticRole: 'admin' }, IDS.admin, {
      db: app
    }).catch((e: Error & { cause?: Error }) => e.cause?.message ?? e.message);
    expect(cause).toMatch(/another admin/);
    await expect(
      resetStaffTwoFactor({ id: IDS.va, kyneticRole: 'va' }, IDS.admin, { db: app })
    ).rejects.toThrow(/Only an admin/);
    // Even a forged role claim is stopped in the database.
    await expect(
      db.app.begin(async (tx) => {
        await tx`select set_config('app.role', 'va', true), set_config('app.user_id', ${IDS.va}, true)`;
        await tx`select admin_reset_staff_two_factor(${IDS.admin}::uuid)`;
      })
    ).rejects.toThrow(/insufficient privilege/);
    await expect(
      db.app.begin(async (tx) => {
        await tx`select set_config('app.role', 'admin', true), set_config('app.user_id', ${IDS.admin}, true)`;
        await tx`select admin_reset_staff_two_factor(${IDS.ownerA}::uuid)`;
      })
    ).rejects.toThrow(/staff user not found/);
    const [u] = await db.admin`select two_factor_enabled from users where id = ${IDS.admin}`;
    expect(u.two_factor_enabled).toBe(true);
  });

  it('the auth role can only write its own audit events and cannot reach the reset function', async () => {
    await expect(
      db.auth`select auth_record_event(${IDS.admin}::uuid, 'user.2fa_reset', '{}'::jsonb)`
    ).rejects.toThrow(/unknown auth event/);
    await expect(db.auth`select admin_reset_staff_two_factor(${IDS.va}::uuid)`).rejects.toThrow(
      /permission denied/
    );
    await expect(db.auth`insert into audit_log (action, entity) values ('x','y')`).rejects.toThrow(
      /permission denied/
    );
    for (const sql of ['select 1 from two_factors']) {
      await expect(db.app.unsafe(sql)).rejects.toThrow(/permission denied/);
      await expect(db.worker.unsafe(sql)).rejects.toThrow(/permission denied/);
    }
    await expect(
      db.auth`update users set kynetic_role = 'admin' where id = ${IDS.ownerA}`
    ).rejects.toThrow(/permission denied/);
  });
});
