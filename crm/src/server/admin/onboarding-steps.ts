import type { ModuleKey } from '../modules';

export type ChecklistStep = {
  stepKey: string;
  title: string;
  moduleKey: ModuleKey | null;
  /** The owner sees client-visible steps only, read-only (F-100). Credentials and vendor ids stay internal. */
  clientVisible: boolean;
  /** Steps the onboarding form itself completes. */
  doneAtCreation: boolean;
};

const step = (
  stepKey: string,
  title: string,
  o: { module?: ModuleKey; visible?: boolean; done?: boolean } = {}
): ChecklistStep => ({
  stepKey,
  title,
  moduleKey: o.module ?? null,
  clientVisible: o.visible ?? true,
  doneAtCreation: o.done ?? false
});

const PLATFORM: ChecklistStep[] = [
  step('tenant_created', 'Client account created', { done: true }),
  step('owner_invited', 'Owner invited'),
  step('modules_set', 'Modules set', { done: true }),
  step('business_profile', 'Business profile, hours and service area', { done: true }),
  step('guarantee_target', 'Guarantee baseline set', { visible: false }),
  step('go_live', 'Go-live')
];

const BY_MODULE: Partial<Record<ModuleKey, ChecklistStep[]>> = {
  alex_core: [
    step('twilio_number', 'Twilio number', { module: 'alex_core', visible: false }),
    step('voice_agent', 'Voice agent configured', { module: 'alex_core', visible: false }),
    step('n8n_workflow', 'n8n workflow built inactive (activation needs a yes)', {
      module: 'alex_core',
      visible: false
    }),
    step('calendar_booking', 'Calendar and booking rules', { module: 'alex_core' }),
    step('consent_wording', 'Consent wording set', { module: 'alex_core' }),
    step('import_done', 'Existing contacts imported', { module: 'alex_core' }),
    step('test_call', 'Test call', { module: 'alex_core' }),
    step('test_text', 'Test text', { module: 'alex_core' })
  ],
  quote_followup: [
    step('quote_followup_setup', 'Quote follow-up sequence reviewed', { module: 'quote_followup' })
  ],
  after_hours: [
    step('after_hours_setup', 'After-hours coverage tested', { module: 'after_hours' })
  ],
  missed_call_textback: [
    step('textback_setup', 'Missed-call text-back tested', { module: 'missed_call_textback' })
  ],
  reactivation: [
    step('reactivation_list', 'Reactivation list approved', { module: 'reactivation' })
  ],
  opm: [step('opm_access', 'Online presence access granted', { module: 'opm', visible: false })],
  crm: [step('crm_review', 'CRM setup reviewed with the owner', { module: 'crm' })]
};

/** The checklist for a new tenant: the platform steps plus the steps of every enabled module (F-100). */
export function buildChecklist(enabled: readonly ModuleKey[]): ChecklistStep[] {
  const set = new Set(enabled);
  const modules = (Object.keys(BY_MODULE) as ModuleKey[]).filter((k) => set.has(k));
  const go = PLATFORM.filter((s) => s.stepKey !== 'go_live');
  return [
    ...go,
    ...modules.flatMap((k) => BY_MODULE[k] ?? []),
    ...PLATFORM.filter((s) => s.stepKey === 'go_live')
  ];
}
