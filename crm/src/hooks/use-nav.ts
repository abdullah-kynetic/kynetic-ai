'use client';

import { useMemo } from 'react';
import { visibleNavGroups } from '@/config/nav-registry';
import { useModules } from '@/components/modules/module-gate';
import type { NavGroup, NavItem } from '@/types';

/**
 * Returns nav items for the shell, filtered by the tenant's modules (M0-13). Role filtering joins in
 * with the first role-specific entries; the server still decides access on every route.
 */
export function useFilteredNavItems(items: NavItem[]) {
  const modules = useModules();
  return useMemo(
    () => visibleNavGroups([{ label: '', items }], modules)[0]?.items ?? [],
    [items, modules]
  );
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  const modules = useModules();
  return useMemo(() => visibleNavGroups(groups, modules), [groups, modules]);
}
