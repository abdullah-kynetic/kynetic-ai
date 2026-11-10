/**
 * Industry templates for onboarding and the template library.
 * A template pre-fills the service list. Pipeline stages are included only when they are specified.
 * Remodeling stage names are editable defaults: the owner can rename them after apply.
 */
export type TemplateStage = {
  name: string;
  probability: number;
  isWon: boolean;
  isLost: boolean;
};

export type IndustryTemplate = {
  label: string;
  services: readonly string[];
  /** When set, these names replace the untouched default sales stages. They stay editable. */
  stages?: readonly TemplateStage[];
  stagesAreEditableDefaults?: boolean;
};

export const REMODELING_STAGES = [
  { name: 'New lead', probability: 5, isWon: false, isLost: false },
  { name: 'Consultation booked', probability: 20, isWon: false, isLost: false },
  { name: 'Design in progress', probability: 40, isWon: false, isLost: false },
  { name: 'Proposal sent', probability: 60, isWon: false, isLost: false },
  { name: 'Contract signed', probability: 80, isWon: false, isLost: false },
  { name: 'Build scheduled', probability: 90, isWon: false, isLost: false },
  { name: 'Won', probability: 100, isWon: true, isLost: false },
  { name: 'Lost', probability: 0, isWon: false, isLost: true }
] as const satisfies readonly TemplateStage[];

export const INDUSTRY_TEMPLATES: Record<
  'roofing' | 'restoration' | 'hvac' | 'plumbing' | 'remodeling' | 'general',
  IndustryTemplate
> = {
  roofing: {
    label: 'Roofing',
    services: ['Roof repair', 'Roof replacement', 'Storm damage', 'Inspection']
  },
  restoration: {
    label: 'Restoration',
    services: ['Water damage', 'Fire and smoke damage', 'Mold remediation', 'Storm damage']
  },
  hvac: {
    label: 'HVAC',
    services: ['AC repair', 'Heating repair', 'System replacement', 'Maintenance']
  },
  plumbing: {
    label: 'Plumbing',
    services: ['Leak repair', 'Drain cleaning', 'Water heater', 'Repiping']
  },
  remodeling: {
    label: 'Remodeling (bath and kitchen)',
    services: ['Bathroom remodel', 'Kitchen remodel', 'Design consultation'],
    stages: REMODELING_STAGES,
    stagesAreEditableDefaults: true
  },
  general: { label: 'Other home service', services: [] }
};

export type IndustryTemplateKey = keyof typeof INDUSTRY_TEMPLATES;
export const INDUSTRY_TEMPLATE_KEYS = Object.keys(INDUSTRY_TEMPLATES) as [
  IndustryTemplateKey,
  ...IndustryTemplateKey[]
];
