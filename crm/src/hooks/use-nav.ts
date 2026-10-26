'use client';

import { useMemo } from 'react';
import type { NavGroup, NavItem } from '@/types';

/**
 * Returns nav items for the shell. Role and module filtering is added by
 * M0-11 and M0-13; until then nothing is filtered.
 */
export function useFilteredNavItems(items: NavItem[]) {
  return useMemo(() => items, [items]);
}

export function useFilteredNavGroups(groups: NavGroup[]) {
  return useMemo(() => groups, [groups]);
}
