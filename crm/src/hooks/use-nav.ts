'use client';

import { useMemo } from 'react';
import { visibleNavGroups } from '@/config/nav-registry';
import { useModules } from '@/components/modules/module-gate';
import type { NavGroup, NavItem } from '@/types';

/**
 * Returns nav items for the shell, filtered by the tenant's modules (M0-13). Entries with `access.role` hide for
 * other roles when a role is passed; the server still decides access on every route.
 */
export function useFilteredNavItems(items: NavItem[], role?: string) {
  const modules = useModules();
  return useMemo(
    () => visibleNavGroups([{ label: '', items }], modules, role)[0]?.items ?? [],
    [items, modules, role]
  );
}

export function useFilteredNavGroups(groups: NavGroup[], role?: string) {
  const modules = useModules();
  return useMemo(() => visibleNavGroups(groups, modules, role), [groups, modules, role]);
}
