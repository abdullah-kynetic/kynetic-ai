'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  moduleSatisfied,
  type CrmLevel,
  type EnabledModules,
  type ModuleKey
} from '@/server/modules/keys';

// UI hiding is cosmetic; the server is the gate (SECURITY 2.4). The layout loads the flags once on
// the server and passes them down as plain data.
export type SerializedModules = { keys: ModuleKey[]; crmLevel: CrmLevel | null };

const ModulesContext = createContext<EnabledModules>({
  keys: new Set<ModuleKey>(['platform']),
  crmLevel: null
});

export function ModulesProvider({
  modules,
  children
}: {
  modules: SerializedModules;
  children: ReactNode;
}) {
  const value = useMemo<EnabledModules>(
    () => ({ keys: new Set(modules.keys), crmLevel: modules.crmLevel }),
    [modules.keys, modules.crmLevel]
  );
  return <ModulesContext.Provider value={value}>{children}</ModulesContext.Provider>;
}

export function useModules(): EnabledModules {
  return useContext(ModulesContext);
}

export function useModuleEnabled(module: ModuleKey, level?: CrmLevel): boolean {
  return moduleSatisfied(useModules(), { module, level });
}

/** Renders nothing when the module is off. No upgrade stub (CODE_STYLE). */
export function ModuleGate({
  module,
  level,
  children
}: {
  module: ModuleKey;
  level?: CrmLevel;
  children: ReactNode;
}) {
  return useModuleEnabled(module, level) ? <>{children}</> : null;
}
