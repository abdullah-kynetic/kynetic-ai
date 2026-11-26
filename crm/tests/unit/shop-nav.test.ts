import { describe, expect, it } from 'vitest';
import { navGroups } from '@/config/nav-config';
import { shopAreas } from '@/config/area-nav';
import { clientNavFor, shopNavGroups } from '@/config/shop-nav';
import { visibleNavGroups } from '@/config/nav-registry';
import type { EnabledModules, ModuleKey } from '@/server/modules/keys';

const enabled = (...keys: ModuleKey[]): EnabledModules => ({
  keys: new Set<ModuleKey>(['platform', ...keys]),
  crmLevel: null
});

// The standard client sidebar as it shipped before the shop track. A-5: this must not change.
const STANDARD_SIDEBAR = [
  {
    label: 'Workspace',
    items: [
      ['Dashboard', '/dashboard', 'dashboard'],
      ['Leads', '/dashboard/leads', 'teams'],
      ['Calls & Bookings', '/dashboard/bookings', 'phone'],
      ['Reputation', '/dashboard/reputation', 'kanban'],
      ['Settings', '/dashboard/settings', 'settings'],
      ['Help', '/dashboard/help', 'help']
    ]
  }
];

describe('A-5 shop sidebar', () => {
  it('leaves the standard sidebar exactly as it was', () => {
    const snapshot = navGroups.map((group) => ({
      label: group.label,
      items: group.items.map((item) => [item.title, item.url, item.icon])
    }));
    expect(snapshot).toEqual(STANDARD_SIDEBAR);
    for (const group of navGroups)
      for (const item of group.items) expect(item.module).toBeUndefined();
  });

  it('a tenant without shop_ops gets the standard sidebar object, untouched', () => {
    expect(clientNavFor({ keys: ['platform'] }, navGroups)).toBe(navGroups);
    expect(clientNavFor({ keys: ['platform', 'crm', 'alex_core'] }, navGroups)).toBe(navGroups);
    expect(visibleNavGroups(navGroups, enabled('crm'), 'owner')).toEqual(
      visibleNavGroups(
        clientNavFor({ keys: ['platform', 'crm'] }, navGroups),
        enabled('crm'),
        'owner'
      )
    );
  });

  it('a shop client sees one entry per area, with pages as tabs', () => {
    const groups = visibleNavGroups(
      clientNavFor({ keys: ['platform', 'shop_ops'] }, navGroups),
      enabled('shop_ops'),
      'owner'
    );
    expect(groups.flatMap((g) => g.items.map((i) => i.title))).toEqual([
      'Today',
      'Front desk',
      'Shop floor',
      'Money',
      'Customers',
      'Control',
      'Settings',
      'Help'
    ]);
    const tabs = (title: string) =>
      shopAreas.find((a) => a.title === title)!.tabs.map((t) => t.label);
    expect(tabs('Front desk')).toEqual(['Leads', 'Calls and texts', 'Calendar']);
    expect(tabs('Shop floor')).toEqual(['Jobs board', 'Quotes', 'Insurance', 'Team']);
    expect(tabs('Customers')).toEqual(['Customers', 'Reviews', 'Get found', 'Referrals']);
  });

  it('every shop entry needs shop_ops, so the registry hides all of them without it', () => {
    for (const group of shopNavGroups)
      for (const item of group.items) expect(item.module).toBe('shop_ops');
    expect(visibleNavGroups(shopNavGroups, enabled('crm'), 'owner')).toEqual([]);
  });

  it('no two shop entries share a destination', () => {
    const urls = shopNavGroups.flatMap((g) => g.items.map((i) => i.url));
    expect(new Set(urls).size).toBe(urls.length);
  });
});
