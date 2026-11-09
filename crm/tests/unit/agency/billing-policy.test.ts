import { it, expect } from 'vitest';
import {
  termsSchema,
  dollarsToCents,
  billingTransition,
  stubStripeEvent
} from '@/server/agency/billing-policy';
const terms = {
  dealId: '11111111-1111-4111-8111-111111111111',
  currency: 'USD',
  setupCents: 10000,
  monthlyCents: null,
  installments: [5000, 5000]
};
it('validates exact installments, optional recurrence and explicit pricing', () => {
  expect(termsSchema.safeParse(terms).success).toBe(true);
  expect(termsSchema.safeParse({ ...terms, installments: [5000] }).success).toBe(false);
  expect(termsSchema.safeParse({ ...terms, setupCents: -1 }).success).toBe(false);
});
it('parses currency without floating point rounding or implicit zero', () => {
  expect(dollarsToCents('12.34')).toBe(1234);
  for (const invalid of ['', '1.001', '-1', 'NaN', '1e3'])
    expect(() => dollarsToCents(invalid)).toThrow();
});
it('rejects live events and never regresses paid invoices', () => {
  expect(stubStripeEvent.safeParse({ livemode: true }).success).toBe(false);
  expect(billingTransition('paid', 'invoice.payment_failed')).toBe('paid');
});
