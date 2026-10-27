import { describe, expect, it } from 'vitest';
import type { AuthUser } from '@/server/auth';
import { decideAdminAccess } from '@/server/admin';
import { adminNavGroups, adminEntryGroup, navGroups } from '@/config/nav-config';

const headers = new Headers();
const user = (over: Partial<AuthUser> = {}): AuthUser => ({
  id: '99999999-9999-4999-8999-999999999999',
  email: 'a@example.test',
  name: 'Ana',
  kyneticRole: null,
  twoFactor: 'not_required',
  ...over
});
const decide = (u: AuthUser | null) => decideAdminAccess(headers, { getUser: async () => u });

describe('decideAdminAccess (M8a-01, F-53 shell)', () => {
  it('sends a signed-out visitor to sign-in', async () => {
    expect(await decide(null)).toEqual({ kind: 'sign_in' });
  });

  it('refuses client owners and staff with 403', async () => {
    expect(await decide(user())).toEqual({ kind: 'forbidden' });
  });

  it('lets a Kynetic admin and a Kynetic VA in once TOTP has passed', async () => {
    const admin = await decide(user({ kyneticRole: 'admin', twoFactor: 'verified' }));
    expect(admin).toMatchObject({ kind: 'ok', role: 'admin' });
    const va = await decide(user({ kyneticRole: 'va', twoFactor: 'verified' }));
    expect(va).toMatchObject({ kind: 'ok', role: 'va' });
  });

  it('holds staff without TOTP at the second-factor page', async () => {
    for (const twoFactor of ['enrol', 'challenge'] as const) {
      expect(await decide(user({ kyneticRole: 'admin', twoFactor }))).toEqual({
        kind: 'second_factor'
      });
    }
  });

  it('checks the role before the second factor, so a client user never learns about TOTP', async () => {
    expect(await decide(user({ twoFactor: 'challenge' }))).toEqual({ kind: 'forbidden' });
  });
});

describe('admin navigation (M8a-01)', () => {
  it('has the all-clients entry point', () => {
    const urls = adminNavGroups.flatMap((g) => g.items.map((i) => i.url));
    expect(urls).toContain('/admin');
  });

  it('keeps the admin entry out of the client registry', () => {
    const urls = navGroups.flatMap((g) => g.items.map((i) => i.url));
    expect(urls).not.toContain('/admin');
    expect(adminEntryGroup.items[0].url).toBe('/admin');
  });
});
