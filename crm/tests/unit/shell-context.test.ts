import { describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '@/server/auth';
import { loadShellContext, roleLabel, type ShellDeps } from '@/server/shell';

const T1 = '11111111-1111-4111-8111-111111111111';
const T2 = '22222222-2222-4222-8222-222222222222';
const headers = new Headers();

function user(over: Partial<AuthUser> = {}): AuthUser {
  return {
    id: '99999999-9999-4999-8999-999999999999',
    email: 'a@b.test',
    name: 'Ana',
    kyneticRole: null,
    twoFactor: 'not_required',
    ...over
  };
}

function deps(over: Partial<ShellDeps> = {}): ShellDeps {
  return {
    getUser: async () => user(),
    listMemberships: async () => [{ tenantId: T1, role: 'owner' }],
    loadTenant: async (ctx) => ({
      name: ctx.tenantId === T1 ? 'Acme Roofing' : 'Other Co',
      logoUrl: null
    }),
    loadModules: async () => ({ keys: ['platform', 'alex_core'], crmLevel: null }),
    ...over
  };
}

describe('loadShellContext (M0-23, DC-057)', () => {
  it('returns null when nobody is signed in, and reads nothing else', async () => {
    const listMemberships = vi.fn();
    const out = await loadShellContext(
      headers,
      undefined,
      deps({ getUser: async () => null, listMemberships })
    );
    expect(out).toBeNull();
    expect(listMemberships).not.toHaveBeenCalled();
  });

  it('gives a client owner their tenant, role and module flags', async () => {
    const out = await loadShellContext(headers, undefined, deps());
    expect(out).toMatchObject({
      role: 'owner',
      tenant: { id: T1, name: 'Acme Roofing' },
      modules: { keys: ['platform', 'alex_core'], crmLevel: null }
    });
  });

  it('loads flags for the member tenant with the member role in the context', async () => {
    const loadModules = vi.fn<ShellDeps['loadModules']>(async () => ({
      keys: ['platform'],
      crmLevel: null
    }));
    await loadShellContext(headers, undefined, deps({ loadModules }));
    expect(loadModules).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: T1, role: 'owner' })
    );
  });

  it('honors a claimed tenant only when a membership backs it', async () => {
    const two = deps({
      listMemberships: async () => [
        { tenantId: T1, role: 'owner' },
        { tenantId: T2, role: 'staff' }
      ]
    });
    expect((await loadShellContext(headers, T2, two))?.tenant?.id).toBe(T2);
    expect((await loadShellContext(headers, T2, two))?.role).toBe('staff');
    const one = deps();
    expect((await loadShellContext(headers, T2, one))?.tenant?.id).toBe(T1);
  });

  it('keeps the Kynetic role for staff acting inside a tenant', async () => {
    const out = await loadShellContext(
      headers,
      undefined,
      deps({ getUser: async () => user({ kyneticRole: 'admin' }) })
    );
    expect(out?.role).toBe('admin');
  });

  it('gives Kynetic staff outside any tenant the platform module only', async () => {
    const loadModules = vi.fn();
    const out = await loadShellContext(
      headers,
      undefined,
      deps({
        getUser: async () => user({ kyneticRole: 'va' }),
        listMemberships: async () => [],
        loadModules
      })
    );
    expect(out).toMatchObject({
      role: 'va',
      tenant: null,
      modules: { keys: ['platform'], crmLevel: null }
    });
    expect(loadModules).not.toHaveBeenCalled();
  });

  it('treats a client with no active tenant as signed out', async () => {
    expect(
      await loadShellContext(headers, undefined, deps({ listMemberships: async () => [] }))
    ).toBeNull();
  });

  it('carries the crm level through for a Lite or Full tenant', async () => {
    const out = await loadShellContext(
      headers,
      undefined,
      deps({ loadModules: async () => ({ keys: ['platform', 'crm'], crmLevel: 'lite' }) })
    );
    expect(out?.modules).toEqual({ keys: ['platform', 'crm'], crmLevel: 'lite' });
  });
});

describe('roleLabel', () => {
  it('names every shell role', () => {
    expect(['owner', 'staff', 'admin', 'va'].map((r) => roleLabel(r as 'owner'))).toEqual([
      'Owner',
      'Team member',
      'Kynetic admin',
      'Kynetic support'
    ]);
  });
});
