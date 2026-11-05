import { describe, expect, it } from 'vitest';
import { buildDevTwentyPlan } from '@/server/leads/dev-twenty-plan';

describe('Twenty dry run requires review before any real writes', () => {
  it('creates only DEV records and references only newly created IDs', () => {
    const plan = buildDevTwentyPlan('https://dev.kyneticai.com');
    expect(plan.mode).toBe('dry_run_only');
    expect(plan.operations.map((op) => op.method)).toEqual(['POST', 'POST', 'POST', 'PATCH']);
    for (const op of plan.operations.filter((op) => op.method === 'POST'))
      expect('name' in op.body && op.body.name).toMatch(/^DEV - /);
    expect(plan.operations[3].path).toBe('/rest/endCustomers/$created.endCustomer.id');
    // No phone/email recipients or references to existing accounts can trigger outreach.
    const text = JSON.stringify(plan);
    expect(text).not.toMatch(/phones|emails|Kynetic Restoration|DELETE/);
    expect(plan.operations[2].body.summary).toContain('no real call');
  });
  it('refuses a production portal context', () => {
    expect(() => buildDevTwentyPlan('https://portal.kyneticai.com')).toThrow('dev-only');
  });
});
