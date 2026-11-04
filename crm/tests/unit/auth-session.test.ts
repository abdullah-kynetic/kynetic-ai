import { createHmac } from 'node:crypto';
import { memoryAdapter } from 'better-auth/adapters/memory';
import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@/server/db/client';
import { createSessionAuth, getVerifiedSessionUser } from '@/server/auth/session';
import { decideAdminAccess } from '@/server/admin/guard';
import { getSessionUser } from '@/server/auth';
import { personaFromHeaders } from '@/server/auth/open-mode';

vi.mock('@/server/env', () => ({
  getEnv: () => ({ NODE_ENV: 'test', DEV_PERSONA_SWITCHING: false })
}));
const secret = 'synthetic-unit-session-cookie-signing-secret-not-for-deployment';
const token = 'synthetic-unit-session-token';
const userId = '11111111-1111-4111-8111-111111111111';
const sessionId = '22222222-2222-4222-8222-222222222222';

function fixture(
  over: {
    role?: string | null;
    expired?: boolean;
    revoked?: boolean;
    disabled?: boolean;
    verified?: boolean;
  } = {}
) {
  const now = new Date();
  const createdAt = new Date(now.getTime() - 60_000);
  const expiresAt = new Date(now.getTime() + (over.expired ? -10_000 : 3_600_000));
  const role = over.role === undefined ? 'admin' : over.role;
  const user = {
    id: userId,
    email: 'unit@example.test',
    name: 'Synthetic',
    emailVerified: true,
    createdAt,
    updatedAt: createdAt
  };
  const session = { id: sessionId, token, userId, expiresAt, createdAt, updatedAt: createdAt };
  const row = {
    ...user,
    kyneticRole: role,
    disabledAt: over.disabled ? now : null,
    expiresAt,
    twoFactorEnabled: true,
    twoFactorVerifiedAt: over.verified === false ? null : createdAt
  };
  const limit = vi.fn().mockResolvedValue([row]);
  const db = {
    select: () => ({ from: () => ({ innerJoin: () => ({ where: () => ({ limit }) }) }) })
  } as unknown as Db;
  const auth = createSessionAuth({
    db,
    baseUrl: 'https://dev.kyneticai.com',
    secret,
    adapter: memoryAdapter({
      user: [user],
      session: over.revoked ? [] : [session],
      account: [],
      verification: []
    })
  });
  const signed = encodeURIComponent(
    `${token}.${createHmac('sha256', secret).update(token).digest('base64')}`
  );
  const headers = new Headers({ cookie: `__Host-kynetic.session_token=${signed}` });
  return { db, auth, now, headers, limit };
}

describe('F-53 verified server sessions', () => {
  it('uses exactly one host-only secure cookie prefix for HTTPS', async () => {
    const context = await fixture().auth.$context;
    expect(context.authCookies.sessionToken.name).toBe('__Host-kynetic.session_token');
    expect(context.authCookies.sessionToken.attributes).toMatchObject({
      secure: true,
      httpOnly: true,
      path: '/'
    });
    expect(context.authCookies.sessionToken.attributes.domain).toBeUndefined();
  });

  it('anonymous and persona-only requests never select an admin or query the DB', async () => {
    const db = { select: vi.fn() } as unknown as Db;
    for (const cookie of ['', 'kynetic_open_as=admin', 'kynetic_open_as=%invalid']) {
      const headers = new Headers(cookie ? { cookie } : {});
      expect(await getSessionUser(headers, { db })).toBeNull();
    }
    expect(db.select).not.toHaveBeenCalled();
    expect(personaFromHeaders(new Headers())).toBeNull();
    expect(personaFromHeaders(new Headers({ cookie: 'kynetic_open_as=%invalid' }))).toBeNull();
    expect(personaFromHeaders(new Headers({ cookie: 'kynetic_open_as=unknown' }))).toBeNull();
  });

  it('allows an admin backed by a real signed cookie and live database session', async () => {
    const f = fixture();
    const getUser = (headers: Headers) => getVerifiedSessionUser(headers, f);
    expect(await decideAdminAccess(f.headers, { getUser })).toMatchObject({
      kind: 'ok',
      role: 'admin'
    });
    expect(f.limit).toHaveBeenCalledOnce();
  });

  it('denies a verified non-admin session despite a forged admin persona cookie', async () => {
    const f = fixture({ role: null });
    f.headers.set('cookie', f.headers.get('cookie') + '; kynetic_open_as=admin');
    expect(
      await decideAdminAccess(f.headers, { getUser: (h) => getVerifiedSessionUser(h, f) })
    ).toEqual({ kind: 'forbidden' });
  });

  it.each([{ expired: true }, { revoked: true }, { disabled: true }])(
    'rejects invalid server-side session state %j',
    async (state) => {
      const f = fixture(state);
      expect(await getVerifiedSessionUser(f.headers, f)).toBeNull();
    }
  );

  it('rejects a forged signed cookie before querying authorization rows', async () => {
    const f = fixture();
    f.headers.set(
      'cookie',
      `__Host-kynetic.session_token=${encodeURIComponent(token + '.unsigned')}`
    );
    expect(await getVerifiedSessionUser(f.headers, f)).toBeNull();
    expect(f.limit).not.toHaveBeenCalled();
  });

  it('does not invent staff second-factor verification', async () => {
    const f = fixture({ verified: false });
    expect(
      await decideAdminAccess(f.headers, { getUser: (h) => getVerifiedSessionUser(h, f) })
    ).toEqual({ kind: 'second_factor' });
  });
});
