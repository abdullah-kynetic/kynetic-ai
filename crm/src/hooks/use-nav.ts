'use client';

import { useMemo } from 'react';
import { visibleNavGroups } from '@/config/nav-registry';
import { useModules } from '@/components/modules/module-gate';
import type { NavGroup } from '@/types';

export function useFilteredNavGroups(groups: NavGroup[], role?: string) {
  const modules = useModules();
  return useMemo(() => visibleNavGroups(groups, modules, role), [groups, modules, role]);
}
