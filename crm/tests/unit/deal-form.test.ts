import { describe, expect, it } from 'vitest';
import { centsToInput, parseDealForm, type DealFormInput } from '@/server/deals/form';

const base: DealFormInput = {
  title: ' Smith roof ',
  value: '$12,500',
  serviceType: '',
  expectedClose: '2026-12-01',
  source: ' Google ',
  ownerId: '',
  stageId: '11111111-1111-4111-8111-111111111111',
  lostReason: ''
};

describe('M2-03 deal form (F-14)', () => {
  it('turns $12,500 into 1250000 cents and trims text', () => {
    const r = parseDealForm(base);
    expect(r.ok && r.value.patch).toEqual({
      title: 'Smith roof',
      valueCents: 1250000,
      serviceType: null,
      expectedClose: '2026-12-01',
      source: 'Google',
      ownerId: null
    });
  });

  it('keeps cents and treats a blank value as zero', () => {
    const cents = parseDealForm({ ...base, value: '12500.50' });
    expect(cents.ok && cents.value.patch.valueCents).toBe(1250050);
    const blank = parseDealForm({ ...base, value: '  ' });
    expect(blank.ok && blank.value.patch.valueCents).toBe(0);
  });

  it('rejects an unreadable amount, a blank title and a missing stage', () => {
    expect(parseDealForm({ ...base, value: '12k' })).toEqual({
      ok: false,
      fieldErrors: { valueCents: ['invalid'] }
    });
    expect(parseDealForm({ ...base, value: '-5' }).ok).toBe(false);
    expect(parseDealForm({ ...base, title: '  ', stageId: '' })).toEqual({
      ok: false,
      fieldErrors: { title: ['required'], stageId: ['required'] }
    });
  });

  it('passes the lost reason through only when one is typed', () => {
    const none = parseDealForm(base);
    expect(none.ok && none.value.lostReason).toBeUndefined();
    const some = parseDealForm({ ...base, lostReason: ' Went with a cheaper quote ' });
    expect(some.ok && some.value.lostReason).toBe('Went with a cheaper quote');
  });

  it('round-trips cents through the input box', () => {
    expect(centsToInput(1250000)).toBe('12500');
    expect(centsToInput(1250050)).toBe('12500.50');
    expect(centsToInput(0)).toBe('0');
    for (const cents of [0, 1, 99, 100, 1250050, 2_147_483_647]) {
      const r = parseDealForm({ ...base, value: centsToInput(cents) });
      expect(r.ok && r.value.patch.valueCents).toBe(cents);
    }
  });
});
