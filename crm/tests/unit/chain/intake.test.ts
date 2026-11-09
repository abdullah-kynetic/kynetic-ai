import { describe, expect, it } from 'vitest';
import { parseDevLead } from '@/server/leads/dev-intake';
const phone = '+' + ['1', '555', '555', '0101'].join('');
const config = { APP_BASE_URL: 'https://dev.kyneticai.com', TEST_PHONE: phone };
const lead = {
  externalId: 'DEV-step3-unit',
  source: 'dev_codex',
  synthetic: true,
  phone,
  businessState: 'CA',
  projectType: 'roof',
  budget: 'synthetic budget'
};
describe('dev intake eligibility', () => {
  it('accepts synthetic TEST_PHONE leads and preserves project/budget without email', () => {
    expect(parseDevLead(lead, config)).toMatchObject({
      projectType: 'roof',
      budget: 'synthetic budget'
    });
  });
  it.each(['FL', 'OK', 'fl', 'Florida', 'Oklahoma', ' ok '])(
    'rejects business state %s',
    (businessState) => {
      expect(() => parseDevLead({ ...lead, businessState }, config)).toThrow();
    }
  );
  it('rejects non-synthetic input, unknown states, other phones, absent TEST_PHONE and prod origin', () => {
    for (const input of [
      { ...lead, synthetic: false },
      { ...lead, externalId: 'real-lead' },
      { ...lead, businessState: 'ZZ' },
      { ...lead, phone: 'other' }
    ])
      expect(() => parseDevLead(input, config)).toThrow();
    expect(() => parseDevLead(lead, { APP_BASE_URL: config.APP_BASE_URL })).toThrow('TEST_PHONE');
    expect(() => parseDevLead(lead, { ...config, TEST_PHONE: 'not-e164' })).toThrow('TEST_PHONE');
    expect(() =>
      parseDevLead(lead, { ...config, APP_BASE_URL: 'https://portal.kyneticai.com' })
    ).toThrow('dev-only');
  });
});
