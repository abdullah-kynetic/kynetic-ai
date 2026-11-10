import { describe, expect, test } from 'vitest';
import { guaranteeProgress, guaranteeTargetFromBaseline } from '../../src/server/metrics';
import {
  readableModuleConfig,
  COMING_SOON_SYSTEMS,
  SYSTEM_CATALOG,
  CATALOG_MODULE_KEYS
} from '../../src/server/modules/catalog';
import { MODULE_KEYS } from '../../src/server/modules/keys';
import { REMODELING_STAGES, INDUSTRY_TEMPLATES } from '../../src/server/admin/industry-templates';
import {
  defaultStageSpecs,
  planServicesApply,
  planStageApply
} from '../../src/server/admin/template-plan';
import { onboardTenantSchema } from '../../src/server/admin';

const defaults = defaultStageSpecs().map((stage, index) => ({ ...stage, id: `s${index}` }));

describe('30-day booking guarantee', () => {
  test('targets 20% more than the baseline over 30 days', () => {
    expect(guaranteeTargetFromBaseline(10)).toBe(12);
    expect(guaranteeTargetFromBaseline(1)).toBe(2);
    expect(guaranteeTargetFromBaseline(0)).toBe(0);
    expect(
      guaranteeProgress({
        baseline: 10,
        startDate: '2026-01-01',
        booked: 6,
        today: new Date('2026-01-16T00:00:00Z')
      })
    ).toEqual({ baseline: 10, target: 12, booked: 6, percent: 50, daysLeft: 15, windowDays: 30 });
  });

  test('hides the tracker until a baseline and a start date exist', () => {
    expect(
      guaranteeProgress({
        baseline: null,
        startDate: '2026-01-01',
        booked: 1,
        today: new Date('2026-01-01T00:00:00Z')
      })
    ).toBeNull();
    expect(
      guaranteeProgress({
        baseline: 4,
        startDate: null,
        booked: 1,
        today: new Date('2026-01-01T00:00:00Z')
      })
    ).toBeNull();
  });
});

describe('template library content', () => {
  test('every module has outcome copy and coming soon systems have no build content', () => {
    expect(CATALOG_MODULE_KEYS).toEqual(MODULE_KEYS);
    for (const key of MODULE_KEYS) expect(SYSTEM_CATALOG[key].outcome.length).toBeGreaterThan(10);
    for (const system of COMING_SOON_SYSTEMS) {
      expect(Object.keys(system).sort()).toEqual(['key', 'name', 'note']);
      expect(system.note).toMatch(/No modules, pipeline stages, or automations are specified/);
    }
  });

  test('remodeling is an onboarding industry with editable default stages', () => {
    expect(INDUSTRY_TEMPLATES.remodeling.stagesAreEditableDefaults).toBe(true);
    expect(INDUSTRY_TEMPLATES.remodeling.services).toEqual([
      'Bathroom remodel',
      'Kitchen remodel',
      'Design consultation'
    ]);
    expect(REMODELING_STAGES.map((stage) => stage.name)).toEqual([
      'New lead',
      'Consultation booked',
      'Design in progress',
      'Proposal sent',
      'Contract signed',
      'Build scheduled',
      'Won',
      'Lost'
    ]);
    expect(
      onboardTenantSchema.safeParse({
        businessName: 'Bath Co',
        ownerEmail: 'a@b.test',
        phone: '4155550100',
        industry: 'remodeling',
        timezone: 'America/Los_Angeles',
        hours: { days: ['mon'], open: '08:00', close: '17:00' },
        plan: 'founding'
      }).success
    ).toBe(true);
  });

  test('stage apply renames only the untouched default pipeline and is idempotent', () => {
    const first = planStageApply(defaults, REMODELING_STAGES);
    expect(first.status).toBe('rename');
    if (first.status !== 'rename') return;
    const renamed = defaults.map((stage, index) => ({
      ...stage,
      name: REMODELING_STAGES[index]!.name,
      probability: REMODELING_STAGES[index]!.probability
    }));
    expect(planStageApply(renamed, REMODELING_STAGES).status).toBe('unchanged');
    expect(planStageApply([{ ...defaults[0]!, name: 'Custom' }], REMODELING_STAGES).status).toBe(
      'customized'
    );
    expect(planStageApply(defaults, undefined).status).toBe('not-defined');
    expect(planServicesApply([], [])).toBe('not-defined');
    expect(planServicesApply(['Bathroom remodel'], INDUSTRY_TEMPLATES.remodeling.services)).toBe(
      'replace'
    );
  });

  test('readable config drops secret-shaped keys', () => {
    expect(
      readableModuleConfig({
        n8nWebhookUrl: 'https://n8n.example.test/hook',
        n8nWebhookSecret: 'hidden',
        outbound_kill_switch: false
      })
    ).toEqual({
      entries: [
        { key: 'n8nWebhookUrl', value: 'https://n8n.example.test/hook' },
        { key: 'outbound_kill_switch', value: 'false' }
      ],
      hidesSecrets: true
    });
  });
});
