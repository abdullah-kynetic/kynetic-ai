import type { NavGroup, NavItem } from '@/types';
import { anyModuleSatisfied, moduleSatisfied, type EnabledModules } from '@/server/modules/keys';

/**
 * Drops nav entries (and groups left empty) for modules the tenant does not have. Entries declare
 * `module` and, for crm, `level`. Entries with no `module` belong to the base portal and always show
 * (PRD F-70, decision 1). Hiding is cosmetic; every route still calls requireModule.
 */
export function visibleNavGroups(
  groups: NavGroup[],
  enabled: EnabledModules,
  role?: string
): NavGroup[] {
  const keep = (item: NavItem): NavItem | null => {
    // Kynetic admins act as the owner when they view a client, so they keep every owner entry.
    if (role && role !== 'admin' && item.access?.role && item.access.role !== role) return null;
    if (item.module && !moduleSatisfied(enabled, { module: item.module, level: item.level })) {
      return null;
    }
    if (item.anyModule && !anyModuleSatisfied(enabled, item.anyModule)) return null;
    const children = (item.items ?? []).map(keep).filter((i): i is NavItem => i !== null);
    return { ...item, items: children };
  };
  return groups
    .map((g) => ({ ...g, items: g.items.map(keep).filter((i): i is NavItem => i !== null) }))
    .filter((g) => g.items.length > 0);
}
