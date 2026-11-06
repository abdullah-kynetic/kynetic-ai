import { z } from 'zod';
export const termsSchema = z
  .strictObject({
    dealId: z.uuid(),
    currency: z.literal('USD'),
    setupCents: z.number().int().min(0).max(100000000),
    monthlyCents: z.number().int().min(1).max(100000000).nullable(),
    installments: z.array(z.number().int().min(1).max(100000000)).max(12)
  })
  .superRefine((v, ctx) => {
    if (v.installments.length && v.installments.reduce((a, b) => a + b, 0) !== v.setupCents)
      ctx.addIssue({
        code: 'custom',
        path: ['installments'],
        message: 'Installments must total the setup fee.'
      });
  });
export function dollarsToCents(raw: string) {
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw.trim()))
    throw new Error('Enter a USD amount with at most two decimal places.');
  const [a, b = ''] = raw.trim().split('.');
  return Number(a) * 100 + Number(b.padEnd(2, '0'));
}
export const stubStripeEvent = z.strictObject({
  id: z.string().regex(/^evt_dev_[A-Za-z0-9_-]{1,100}$/),
  livemode: z.literal(false),
  created: z.number().int().positive(),
  type: z.enum(['invoice.finalized', 'invoice.paid', 'invoice.payment_failed']),
  data: z.strictObject({
    object: z.strictObject({
      id: z.string().startsWith('in_dev_'),
      livemode: z.literal(false),
      currency: z.literal('usd'),
      amount_due: z.number().int().positive(),
      metadata: z.strictObject({ agencyInvoiceId: z.uuid() })
    })
  })
});
export function billingTransition(current: string, event: string) {
  if (current === 'paid') return 'paid';
  return event === 'invoice.paid'
    ? 'paid'
    : event === 'invoice.payment_failed'
      ? 'past_due'
      : current === 'past_due'
        ? 'past_due'
        : 'open';
}
