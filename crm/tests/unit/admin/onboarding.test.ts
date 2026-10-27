import { describe, expect, it } from 'vitest';
import {
  buildChecklist,
  expandModules,
  normalizePhone,
  onboardTenantSchema,
  slugify
} from '@/server/admin';

describe('M8a-02 onboarding helpers (F-55)', () => {
  it('normalizes phones to E.164 and refuses junk', () => {
    expect(normalizePhone('(415) 555-0100')).toBe('+14155550100');
    expect(normalizePhone('1 415 555 0100')).toBe('+14155550100');
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('555')).toBeNull();
  });

  it('makes a valid slug from a name', () => {
    expect(slugify("Bob's Roofing & Sons!")).toBe('bob-s-roofing-sons');
    expect(slugify('A')).toBe('a');
  });

  it('the bundle turns its three members on', () => {
    expect(expandModules(['followup_bundle'])).toEqual([
      'quote_followup',
      'missed_call_textback',
      'reactivation',
      'followup_bundle'
    ]);
    expect(expandModules(['alex_core'])).toEqual(['alex_core']);
  });

  it('builds module-specific checklists with internal steps hidden from owners', () => {
    const base = buildChecklist(['platform']);
    expect(base.map((s) => s.stepKey)).toEqual([
      'tenant_created',
      'owner_invited',
      'modules_set',
      'business_profile',
      'guarantee_target',
      'go_live'
    ]);
    const alex = buildChecklist(['platform', 'alex_core', 'crm']);
    expect(alex.at(-1)!.stepKey).toBe('go_live');
    expect(alex.find((s) => s.stepKey === 'twilio_number')!.clientVisible).toBe(false);
    expect(alex.find((s) => s.stepKey === 'crm_review')).toBeDefined();
    expect(new Set(alex.map((s) => s.stepKey)).size).toBe(alex.length);
  });

  it('rejects unknown keys, a bad color and reversed hours', () => {
    const ok = {
      businessName: 'A Co',
      ownerEmail: 'a@b.test',
      phone: '4155550100',
      industry: 'hvac',
      timezone: 'America/Denver',
      hours: { days: ['mon'], open: '08:00', close: '17:00' },
      plan: 'value'
    };
    expect(onboardTenantSchema.safeParse(ok).success).toBe(true);
    expect(onboardTenantSchema.safeParse({ ...ok, extra: 1 }).success).toBe(false);
    expect(onboardTenantSchema.safeParse({ ...ok, primaryColor: 'red' }).success).toBe(false);
    expect(
      onboardTenantSchema.safeParse({
        ...ok,
        hours: { days: ['mon'], open: '17:00', close: '08:00' }
      }).success
    ).toBe(false);
    expect(onboardTenantSchema.safeParse({ ...ok, timezone: 'Mars/Base' }).success).toBe(false);
  });
});
