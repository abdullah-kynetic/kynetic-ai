import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/server/auth';
import { proxy } from '@/proxy';
import { GET as switchPersona } from '@/app/open/[persona]/route';

const state = vi.hoisted(() => ({
  user: null as AuthUser | null,
  env: { APP_BASE_URL: 'https://dev.kyneticai.com', NODE_ENV: 'test', DEV_PERSONA_SWITCHING: false }
}));
vi.mock('@/server/auth/session', () => ({ getVerifiedSessionUser: async () => state.user }));
vi.mock('@/server/env', () => ({ getEnv: () => state.env }));
const admin: AuthUser = {
  id: 'synthetic-admin',
  email: 'admin@example.test',
  name: null,
  kyneticRole: 'admin',
  twoFactor: 'verified'
};
const request = (path: string) =>
  new NextRequest(`https://dev.kyneticai.com${path}`, {
    headers: { cookie: 'kynetic_open_as=admin' }
  });
afterEach(() => {
  state.user = null;
  state.env.NODE_ENV = 'test';
  state.env.DEV_PERSONA_SWITCHING = false;
});

describe('F-53 raw admin HTTP authorization before rendering', () => {
  it.each(['/admin', '/admin/users', '/api/admin/clients/example/documents'])(
    'anonymous %s gets 401 even with an admin persona cookie',
    async (path) => {
      const response = await proxy(request(path));
      expect(response.status).toBe(401);
      expect(response.headers.get('cache-control')).toBe('no-store');
    }
  );
  it('prefetch headers cannot bypass admin authorization', async () => {
    const req = request('/admin');
    req.headers.set('purpose', 'prefetch');
    req.headers.set('next-router-prefetch', '1');
    expect((await proxy(req)).status).toBe(401);
  });
  it('a verified non-admin gets 403', async () => {
    state.user = { ...admin, kyneticRole: null, twoFactor: 'not_required' };
    expect((await proxy(request('/admin'))).status).toBe(403);
  });
  it('a verified admin is allowed through', async () => {
    state.user = admin;
    const response = await proxy(request('/admin'));
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });
  it('staff without second-factor verification gets 403', async () => {
    state.user = { ...admin, twoFactor: 'challenge' };
    expect((await proxy(request('/admin'))).status).toBe(403);
  });
});

describe('dashboard sign-in completion', () => {
  it('redirects anonymous visitors to sign-in', async () => {
    const response = await proxy(request('/dashboard'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://dev.kyneticai.com/sign-in');
  });
  it('redirects pending staff sessions to TOTP instead of exposing dashboard data', async () => {
    state.user = { ...admin, twoFactor: 'enrol' };
    const response = await proxy(request('/dashboard'));
    expect(response.headers.get('location')).toBe('https://dev.kyneticai.com/staff/2fa');
  });
});

describe('dev-only persona switching', () => {
  const run = () =>
    switchPersona(request('/open/admin'), { params: Promise.resolve({ persona: 'admin' }) });
  it('is disabled by default', async () => {
    expect((await run()).status).toBe(404);
  });
  it('cannot be enabled in production', async () => {
    state.env.NODE_ENV = 'production';
    state.env.DEV_PERSONA_SWITCHING = true;
    state.user = admin;
    expect((await run()).status).toBe(404);
  });
  it('requires a verified session even when explicitly enabled', async () => {
    state.env.DEV_PERSONA_SWITCHING = true;
    expect((await run()).status).toBe(401);
  });
  it('refuses non-admin sessions', async () => {
    state.env.DEV_PERSONA_SWITCHING = true;
    state.user = { ...admin, kyneticRole: null };
    expect((await run()).status).toBe(403);
  });
  it('works for an authenticated admin only in explicitly enabled development', async () => {
    state.env.DEV_PERSONA_SWITCHING = true;
    state.user = admin;
    const response = await run();
    expect(response.status).toBe(303);
    expect(response.headers.get('set-cookie')).toContain('kynetic_open_as=admin');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
  });
});
