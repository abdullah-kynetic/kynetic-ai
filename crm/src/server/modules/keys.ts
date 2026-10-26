// Pure module definitions, safe to import from client code. Keys match module_catalog (PRD F-70).
export const MODULE_KEYS = [
  'platform',
  'alex_core',
  'quote_followup',
  'after_hours',
  'missed_call_textback',
  'reactivation',
  'opm',
  'followup_bundle',
  'crm'
] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];

export type CrmLevel = 'lite' | 'full';

/** What a tenant has switched on. `crm` carries its level. */
export type EnabledModules = { keys: ReadonlySet<ModuleKey>; crmLevel: CrmLevel | null };

export type ModuleNeed = { module: ModuleKey; level?: CrmLevel };

/**
 * Pure rule shared by the server guard and the UI gate, so they cannot disagree.
 * - `platform` is always on (cannot be turned off).
 * - `missed_call_textback` is free with `after_hours` (decisions, PRD F-81).
 * - `crm` level `full` includes everything `lite` has; `lite` does not include full-only surfaces.
 */
export function moduleSatisfied(enabled: EnabledModules, need: ModuleNeed): boolean {
  const { module, level } = need;
  if (module === 'platform') return true;
  if (module === 'crm') {
    if (!enabled.keys.has('crm') || !enabled.crmLevel) return false;
    return level === 'full' ? enabled.crmLevel === 'full' : true;
  }
  if (module === 'missed_call_textback') {
    return enabled.keys.has('missed_call_textback') || enabled.keys.has('after_hours');
  }
  return enabled.keys.has(module);
}
