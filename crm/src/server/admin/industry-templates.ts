/**
 * Industry templates for the onboarding form (F-55). A template only pre-fills the tenant's `services`
 * list; the default pipeline and Alex draft come from `create_tenant`, and automations are switched on
 * per module by M7. Adding a trade is one entry here.
 */
export const INDUSTRY_TEMPLATES = {
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
  general: { label: 'Other home service', services: [] }
} as const satisfies Record<string, { label: string; services: readonly string[] }>;

export type IndustryTemplateKey = keyof typeof INDUSTRY_TEMPLATES;
export const INDUSTRY_TEMPLATE_KEYS = Object.keys(INDUSTRY_TEMPLATES) as [
  IndustryTemplateKey,
  ...IndustryTemplateKey[]
];
