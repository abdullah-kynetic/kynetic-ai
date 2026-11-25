import { beforeEach, describe, expect, it, vi } from 'vitest';

const load = vi.fn();
const enabled = vi.fn();
const jar: Record<string, string> = {};

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (jar[name] ? { value: jar[name] } : undefined) }),
  headers: async () => new Headers()
}));
vi.mock('next/navigation', () => ({
  forbidden: () => {
    throw new Error('FORBIDDEN');
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  }
}));
vi.mock('@/server/shell', () => ({ loadShellContext: (...args: unknown[]) => load(...args) }));
vi.mock('@/server/modules', () => ({ isModuleEnabled: (...args: unknown[]) => enabled(...args) }));

import { shopContext } from '@/app/dashboard/shop/_lib/context';

const tenant = { id: '61eba07c-c5e7-44d5-a8dd-9c4bd2f8c08b' };
const user = { id: '33995fd6-f5f0-4819-8695-0fcf0d86e7a4' };

beforeEach(() => {
  load.mockReset();
  enabled.mockReset();
  for (const k of Object.keys(jar)) delete jar[k];
  enabled.mockResolvedValue(true);
});

describe('shop page context', () => {
  it('passes the View as client cookie to the shell, so staff see the client, read-only', async () => {
    jar.view_as = 'session-cookie';
    jar.tenant_id = 'claimed';
    load.mockResolvedValue({
      user,
      role: 'admin',
      tenant,
      viewAs: { readOnly: true }
    });
    const ctx = await shopContext();
    expect(load).toHaveBeenCalledWith(expect.anything(), 'claimed', undefined, 'session-cookie');
    expect(ctx).toEqual({ tenantId: tenant.id, userId: user.id, role: 'admin', readOnly: true });
    expect(enabled).toHaveBeenCalledWith(ctx, 'shop_ops');
  });

  it('is an ordinary read-write context for the client themselves', async () => {
    load.mockResolvedValue({ user, role: 'owner', tenant, viewAs: null });
    const ctx = await shopContext();
    expect(ctx).toEqual({ tenantId: tenant.id, userId: user.id, role: 'owner' });
  });

  it('is forbidden when the module is off and redirects when signed out', async () => {
    load.mockResolvedValue({ user, role: 'owner', tenant, viewAs: null });
    enabled.mockResolvedValue(false);
    await expect(shopContext()).rejects.toThrow('FORBIDDEN');
    load.mockResolvedValue(null);
    await expect(shopContext()).rejects.toThrow('REDIRECT /sign-in');
  });
});
