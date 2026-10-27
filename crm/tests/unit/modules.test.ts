// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { visibleNavGroups } from '@/config/nav-registry';
import { moduleSatisfied, type EnabledModules, type ModuleKey } from '@/server/modules/keys';
import type { NavGroup } from '@/types';

const on = (keys: ModuleKey[], crmLevel: 'lite' | 'full' | null = null): EnabledModules => ({
  keys: new Set<ModuleKey>(['platform', ...keys]),
  crmLevel
});

describe('F-70 moduleSatisfied', () => {
  it('platform is always on, even with nothing loaded', () => {
    expect(moduleSatisfied({ keys: new Set(), crmLevel: null }, { module: 'platform' })).toBe(true);
  });

  it('text-back is free with after_hours', () => {
    expect(moduleSatisfied(on(['after_hours']), { module: 'missed_call_textback' })).toBe(true);
    expect(moduleSatisfied(on([]), { module: 'missed_call_textback' })).toBe(false);
    expect(moduleSatisfied(on(['missed_call_textback']), { module: 'after_hours' })).toBe(false);
  });

  it('crm levels: full includes lite, lite does not include full', () => {
    expect(moduleSatisfied(on(['crm'], 'full'), { module: 'crm', level: 'lite' })).toBe(true);
    expect(moduleSatisfied(on(['crm'], 'lite'), { module: 'crm', level: 'full' })).toBe(false);
    expect(moduleSatisfied(on(['crm'], 'lite'), { module: 'crm', level: 'lite' })).toBe(true);
    expect(moduleSatisfied(on([]), { module: 'crm', level: 'lite' })).toBe(false);
    expect(moduleSatisfied(on([]), { module: 'crm' })).toBe(false);
  });
});

const groups: NavGroup[] = [
  {
    label: 'Base',
    items: [
      { title: 'Leads', url: '/leads', items: [] },
      { title: 'Calls', url: '/calls', module: 'alex_core', items: [] }
    ]
  },
  {
    label: 'CRM',
    items: [
      { title: 'Companies', url: '/companies', module: 'crm', level: 'lite', items: [] },
      {
        title: 'Settings',
        url: '/settings',
        items: [{ title: 'Custom fields', url: '/settings/fields', module: 'crm', level: 'full' }]
      }
    ]
  }
];

describe('F-70 nav registry', () => {
  it('crm off still shows base portal routes and drops crm entries and empty groups', () => {
    const v = visibleNavGroups(groups, on(['alex_core']));
    expect(v.map((g) => g.label)).toEqual(['Base', 'CRM']);
    expect(v[0].items.map((i) => i.title)).toEqual(['Leads', 'Calls']);
    expect(v[1].items.map((i) => i.title)).toEqual(['Settings']);
    expect(v[1].items[0].items).toEqual([]);
  });

  it('a tenant without alex_core loses Calls but keeps Leads', () => {
    const v = visibleNavGroups(groups, on([]));
    expect(v[0].items.map((i) => i.title)).toEqual(['Leads']);
  });

  it('lite sees Companies but not Custom fields; full sees both', () => {
    const lite = visibleNavGroups(groups, on(['crm'], 'lite'));
    expect(lite[1].items.map((i) => i.title)).toEqual(['Companies', 'Settings']);
    expect(lite[1].items[1].items).toEqual([]);
    const full = visibleNavGroups(groups, on(['crm'], 'full'));
    expect(full[1].items[1].items?.map((i) => i.title)).toEqual(['Custom fields']);
  });
});
