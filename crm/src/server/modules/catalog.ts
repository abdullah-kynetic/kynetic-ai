import { MODULE_KEYS, type ModuleKey } from './keys';

/**
 * Outcome copy and the automation catalog the portal already ships.
 * Labels match `module_catalog` and `automation_templates` (migration 0012).
 * Plan 2 names are listed only as coming soon: D-013 names them and does not specify modules,
 * stages, or automations. Nothing in this file invents that content.
 */
export const SYSTEM_CATALOG: Record<ModuleKey, { label: string; outcome: string }> = {
  platform: {
    label: 'Base portal',
    outcome: 'Sign-in, leads, the pipeline, and settings stay available on this account.'
  },
  alex_core: {
    label: 'Alex speed-to-lead',
    outcome:
      'Every new lead gets a call back in under a minute, and booked estimates land on the calendar.'
  },
  quote_followup: {
    label: 'Quote follow-up',
    outcome: 'A sent quote gets follow-up until the homeowner replies or the job is won or lost.'
  },
  after_hours: {
    label: 'After-hours answering',
    outcome: 'Calls that come in after hours are answered, logged, and the office is notified.'
  },
  missed_call_textback: {
    label: 'Missed-call text-back',
    outcome: 'A caller who does not reach the office gets one text back.'
  },
  reactivation: {
    label: 'Old-lead reactivation',
    outcome: 'A chosen list of old leads can be contacted once, and only when consent allows it.'
  },
  opm: {
    label: 'Online presence',
    outcome:
      'The Google profile, review sites, directory listings, and posts are tracked in one place.'
  },
  followup_bundle: {
    label: 'Follow-up bundle',
    outcome: 'Quote follow-up, old-lead reactivation, and missed-call text-back run together.'
  },
  crm: {
    label: 'CRM',
    outcome: 'Companies, tasks, notes, and pipeline stages match how this business works.'
  }
};

export const AUTOMATION_TEMPLATE_CATALOG = [
  { key: 'speed_to_lead', moduleKey: 'alex_core', label: 'Speed to lead' },
  { key: 'reactivation', moduleKey: 'reactivation', label: 'Old-lead reactivation' },
  { key: 'quote_followup', moduleKey: 'quote_followup', label: 'Quote follow-up' },
  { key: 'appointment_reminders', moduleKey: 'alex_core', label: 'Appointment reminders' },
  { key: 'no_show_recovery', moduleKey: 'alex_core', label: 'No-show recovery' },
  { key: 'missed_call_textback', moduleKey: 'missed_call_textback', label: 'Missed-call text-back' }
] as const satisfies readonly { key: string; moduleKey: ModuleKey; label: string }[];

export type AutomationTemplateKey = (typeof AUTOMATION_TEMPLATE_CATALOG)[number]['key'];

/** D-013 Plan 2 names. No module key, stages, or automations are specified for these. */
export const COMING_SOON_SYSTEMS = [
  {
    key: 'reputation_engine',
    name: 'Reputation Engine',
    note: 'Named as later work. No modules, pipeline stages, or automations are specified.'
  },
  {
    key: 'inbound_receptionist',
    name: 'Inbound AI receptionist',
    note: 'Named as later work. No modules, pipeline stages, or automations are specified.'
  },
  {
    key: 'lead_recovery_nurture',
    name: 'Lead recovery and nurture',
    note: 'Named as later work. No modules, pipeline stages, or automations are specified.'
  }
] as const;

const SECRET_KEY = /secret|token|password|ciphertext|api[_-]?key/i;

/** Non-secret scalar settings already stored on a module. Secret-shaped keys are omitted. */
export function readableModuleConfig(config: unknown): {
  entries: { key: string; value: string }[];
  hidesSecrets: boolean;
} {
  if (!config || typeof config !== 'object' || Array.isArray(config))
    return { entries: [], hidesSecrets: false };
  let hidesSecrets = false;
  const entries: { key: string; value: string }[] = [];
  for (const [key, value] of Object.entries(config)) {
    if (SECRET_KEY.test(key)) {
      hidesSecrets = true;
      continue;
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
      entries.push({ key, value: String(value) });
  }
  return { entries, hidesSecrets };
}

export function automationsForModule(moduleKey: ModuleKey) {
  return AUTOMATION_TEMPLATE_CATALOG.filter((row) => row.moduleKey === moduleKey);
}

export const CATALOG_MODULE_KEYS: readonly ModuleKey[] = MODULE_KEYS;
