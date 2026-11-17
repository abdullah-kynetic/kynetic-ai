import { describe, expect, it } from 'vitest';
import {
  filterWorkspaces,
  initials,
  moveActive,
  safeAdminReturn,
  toWorkspaces
} from '@/lib/workspaces';

const rows = [
  { tenantId: 'b', slug: 'zeta-roofing', name: 'Zeta Roofing', plan: 'full', status: 'active' },
  { tenantId: 'a', slug: 'alpha-pools', name: 'Alpha Pools', plan: 'lite', status: 'onboarding' },
  { tenantId: 'c', slug: 'demo-one', name: 'Demo One', plan: 'full', status: 'onboarding' },
  { tenantId: 'd', slug: 'gone', name: 'Gone Co', plan: 'full', status: 'offboarded' },
  { tenantId: 'e', slug: 'demo-kynetic-agency', name: 'Agency', plan: 'full', status: 'active' }
];
const list = toWorkspaces(rows, {
  demoSlugs: new Set(['demo-one']),
  hiddenSlugs: new Set(['demo-kynetic-agency'])
});

describe('workspace model', () => {
  it('drops offboarded and hidden tenants and sorts by name', () => {
    expect(list.map((w) => w.name)).toEqual(['Alpha Pools', 'Demo One', 'Zeta Roofing']);
  });

  it('only lets ready and demo portals be viewed as the client', () => {
    expect(Object.fromEntries(list.map((w) => [w.name, w.canView]))).toEqual({
      'Alpha Pools': false,
      'Demo One': true,
      'Zeta Roofing': true
    });
    expect(list[0]!.detail).toBe('Lite plan · Building');
  });

  it('filters by name or detail, case-insensitively', () => {
    expect(filterWorkspaces(list, ' roof ').map((w) => w.name)).toEqual(['Zeta Roofing']);
    expect(filterWorkspaces(list, 'building').map((w) => w.name)).toEqual(['Alpha Pools']);
    expect(filterWorkspaces(list, '')).toHaveLength(3);
    expect(filterWorkspaces(list, 'nothing')).toEqual([]);
  });

  it('handles 100+ clients', () => {
    const many = toWorkspaces(
      Array.from({ length: 150 }, (_, i) => ({
        tenantId: `t${i}`,
        slug: `client-${i}`,
        name: `Client ${String(i).padStart(3, '0')}`,
        plan: 'full',
        status: 'active'
      })),
      { demoSlugs: new Set() }
    );
    expect(many).toHaveLength(150);
    expect(filterWorkspaces(many, 'client 14')).toHaveLength(10);
  });

  it('builds initials', () => {
    expect(initials('Super Roofer LLC')).toBe('SR');
    expect(initials('Kynetic')).toBe('KY');
    expect(initials('  ')).toBe('K');
  });

  it('moves the active row with wrap-around', () => {
    expect(moveActive(-1, 3, 'ArrowDown')).toBe(0);
    expect(moveActive(2, 3, 'ArrowDown')).toBe(0);
    expect(moveActive(0, 3, 'ArrowUp')).toBe(2);
    expect(moveActive(1, 3, 'ArrowUp')).toBe(0);
    expect(moveActive(0, 0, 'ArrowDown')).toBe(-1);
  });

  it('only returns to admin paths', () => {
    expect(safeAdminReturn('/admin/clients?x=1')).toBe('/admin/clients?x=1');
    for (const bad of [
      'https://evil.test',
      '//evil.test',
      '/dashboard',
      '/admin\\x',
      undefined,
      '/admin\nx'
    ])
      expect(safeAdminReturn(bad)).toBe('/admin');
  });
});
