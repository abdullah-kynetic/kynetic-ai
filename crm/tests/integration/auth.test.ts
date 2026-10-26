import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuth, getSessionUser, type Auth } from '@/server/auth';
import { createDb } from '@/server/db/client';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let auth: Auth;
let sent: { email: string; url: string }[] = [];
const BASE = 'http://localhost:3000';

beforeAll(async () => {
  db = await createTestDatabase();
  await seedTwoTenants(db.admin);
  auth = createAuth({
    db: createDb(db.auth),
    baseUrl: BASE,
    secret: 'integration-test-secret-0123456789abcdef',
    sendMagicLink: async (m) => {
      sent.push(m);
    }
  });
});
afterAll(async () => {
  await db?.drop();
});

const authDb = () => createDb(db.auth);
const headers = () => new Headers({ origin: BASE });

async function requestLink(email: string): Promise<string | undefined> {
  sent = [];
  await auth.api.signInMagicLink({ body: { email }, headers: headers() });
  const url = sent[0]?.url;
  return url ? new URL(url).searchParams.get('token')! : undefined;
}

async function verify(token: string): Promise<Response> {
  return auth.api.magicLinkVerify({ query: { token }, headers: headers(), asResponse: true });
}

function cookieHeader(res: Response): Headers {
  const jar = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  return new Headers({ cookie: jar });
}

describe('M0-10 magic-link sign-in (F-71)', () => {
  it('signs a member in with a magic link and resolves the session user', async () => {
    const token = await requestLink('owner-a@example.test');
    expect(token).toBeTruthy();
    const res = await verify(token!);
    const user = await getSessionUser(cookieHeader(res), { auth, db: authDb() });
    expect(user).toMatchObject({
      id: IDS.ownerA,
      email: 'owner-a@example.test',
      kyneticRole: null
    });
    const [row] =
      await db.admin`select last_login_at, email_verified from users where id = ${IDS.ownerA}`;
    expect(row.last_login_at).not.toBeNull();
    expect(row.email_verified).toBe(true);
  });

  it('refuses a person with no membership and no invitation, and sends nothing', async () => {
    expect(await requestLink('stranger@example.test')).toBeUndefined();
    const [{ n }] =
      await db.admin`select count(*)::int as n from users where email = 'stranger@example.test'`;
    expect(n).toBe(0);
  });

  it('creating a user or a session behind the gate is refused too', async () => {
    const ctx = await auth.$context;
    await expect(
      ctx.internalAdapter.createUser(
        { email: 'stranger@example.test', name: 'S', emailVerified: true },
        { method: 'email-otp' as never }
      )
    ).rejects.toThrow();
    await db.admin`insert into users (id, email) values ('dddddddd-0000-4000-8000-000000000001', 'orphan@example.test')`;
    await expect(
      ctx.internalAdapter.createSession('dddddddd-0000-4000-8000-000000000001')
    ).rejects.toThrow();
    const [{ n }] =
      await db.admin`select count(*)::int as n from sessions where user_id = 'dddddddd-0000-4000-8000-000000000001'`;
    expect(n).toBe(0);
  });

  it('lets an invited person in, so the accept page can create their membership', async () => {
    const token = await requestLink('invitee-a@example.test');
    expect(token).toBeTruthy();
    const res = await verify(token!);
    const user = await getSessionUser(cookieHeader(res), { auth, db: authDb() });
    expect(user?.email).toBe('invitee-a@example.test');
  });

  it('refuses an expired invitation', async () => {
    await db.admin`update invitations set expires_at = now() - interval '1 minute' where email = 'invitee-b@example.test'`;
    expect(await requestLink('invitee-b@example.test')).toBeUndefined();
  });

  it('a magic link works once', async () => {
    const token = await requestLink('staff-a@example.test');
    const first = await verify(token!);
    expect(await getSessionUser(cookieHeader(first), { auth, db: authDb() })).not.toBeNull();
    const second = await verify(token!);
    expect(second.headers.getSetCookie().join('')).not.toMatch(/session_token=[^;]+/);
    expect(second.headers.get('location') ?? '').toMatch(/error=/i);
  });

  it('an expired link is refused', async () => {
    const token = await requestLink('owner-b@example.test');
    await db.admin`update verifications set expires_at = now() - interval '1 minute'`;
    const res = await verify(token!);
    expect(res.headers.getSetCookie().join('')).not.toMatch(/session_token=[^;]+/);
    expect(res.headers.get('location') ?? '').toMatch(/error=/i);
  });

  it('staff do not get email links (Google plus TOTP only)', async () => {
    expect(await requestLink('admin@example.test')).toBeUndefined();
  });

  it('stores the link token hashed, never in the clear', async () => {
    const token = await requestLink('owner-a@example.test');
    const rows = await db.admin`select identifier from verifications`;
    expect(rows.map((r) => r.identifier)).not.toContain(token);
  });
});

describe('M0-10 session lifetimes and live checks (SECURITY 2.1)', () => {
  async function session(email: string): Promise<Headers> {
    const token = await requestLink(email);
    return cookieHeader(await verify(token!));
  }

  it('drops a client session idle for more than 30 days', async () => {
    const h = await session('owner-a@example.test');
    const now = new Date(Date.now() + 31 * 24 * 3600 * 1000);
    expect(await getSessionUser(h, { auth, db: authDb(), now })).toBeNull();
  });

  it('drops a client session older than 90 days even when active', async () => {
    const h = await session('owner-a@example.test');
    await db.admin`update sessions set created_at = now() - interval '91 days' where user_id = ${IDS.ownerA}`;
    expect(await getSessionUser(h, { auth, db: authDb() })).toBeNull();
  });

  it('applies the shorter staff idle limit of 12 hours', async () => {
    // Staff reach a session only through Google; build one directly to test the lifetime rule.
    const ctx = await auth.$context;
    const s = await ctx.internalAdapter.createSession(IDS.va);
    const h = new Headers({ cookie: `better-auth.session_token=${await signed(ctx, s.token)}` });
    expect(await getSessionUser(h, { auth, db: authDb() })).toMatchObject({ kyneticRole: 'va' });
    await db.admin`update sessions set updated_at = now() - interval '13 hours' where user_id = ${IDS.va}`;
    expect(await getSessionUser(h, { auth, db: authDb() })).toBeNull();
  });

  it('a disabled user loses the session at once', async () => {
    const h = await session('owner-b@example.test');
    expect(await getSessionUser(h, { auth, db: authDb() })).not.toBeNull();
    await db.admin`update users set disabled_at = now() where id = ${IDS.ownerB}`;
    expect(await getSessionUser(h, { auth, db: authDb() })).toBeNull();
  });
});

describe('M0-10 kynetic_auth privileges (DC-055)', () => {
  it('cannot read or write tenant data', async () => {
    await expect(db.auth`select id from contacts limit 1`).rejects.toThrow(/permission denied/);
    await expect(db.auth`select id from tenants limit 1`).rejects.toThrow(/permission denied/);
    await expect(db.auth`select tenant_id from memberships limit 1`).rejects.toThrow(
      /permission denied/
    );
  });

  it('cannot grant itself a staff role or disable or re-enable a user', async () => {
    await expect(
      db.auth`update users set kynetic_role = 'admin' where id = ${IDS.ownerA}`
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.auth`update users set disabled_at = null where id = ${IDS.ownerB}`
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.auth`insert into users (email, kynetic_role) values ('x@example.test', 'admin')`
    ).rejects.toThrow(/permission denied/);
  });

  it('the app and worker roles cannot see auth tables', async () => {
    for (const t of ['sessions', 'accounts', 'verifications']) {
      await expect(db.app.unsafe(`select 1 from ${t}`)).rejects.toThrow(/permission denied/);
      await expect(db.worker.unsafe(`select 1 from ${t}`)).rejects.toThrow(/permission denied/);
    }
  });
});

async function signed(ctx: Awaited<Auth['$context']>, token: string): Promise<string> {
  const { serializeSignedCookie } = await import('better-call');
  const cookie = await serializeSignedCookie('better-auth.session_token', token, ctx.secret);
  return decodeURIComponent(cookie.split(';')[0].split('=').slice(1).join('='));
}
