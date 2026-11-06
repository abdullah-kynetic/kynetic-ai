import { beforeAll, afterAll, it, expect } from 'vitest';
import { setupAgency, agencyAdmin as caller } from '../helpers/agency';
import { createAgencyLead } from '@/server/agency';
import {
  saveAgencyTerms,
  createAgencyInvoice,
  applyAgencyBillingWebhook,
  draftAgencyDunning,
  getAgencyBilling
} from '@/server/agency/billing';
let a: Awaited<ReturnType<typeof setupAgency>>,
  dealId: string,
  invoice: Awaited<ReturnType<typeof createAgencyInvoice>>;
beforeAll(async () => {
  a = await setupAgency();
  dealId = (
    await createAgencyLead(
      caller,
      {
        firstName: 'DEV Billing',
        email: 'billing@example.test',
        direction: 'inbound',
        channel: 'form'
      },
      { db: a.db }
    )
  ).dealId;
});
afterAll(async () => {
  await a?.close();
});
it('supports per-deal installments/monthly pricing and idempotent immutable invoice snapshots', async () => {
  await saveAgencyTerms(
    caller,
    { dealId, currency: 'USD', setupCents: 10000, monthlyCents: 2500, installments: [5000, 5000] },
    { db: a.db }
  );
  const input = { dealId, kind: 'setup', installment: 0, dueOn: '2026-11-01' };
  invoice = await createAgencyInvoice(caller, input, { db: a.db });
  expect(invoice.amount_cents).toBe(5000);
  expect((await createAgencyInvoice(caller, input, { db: a.db })).id).toBe(invoice.id);
  await expect(
    createAgencyInvoice(caller, { ...input, dueOn: '2026-11-02' }, { db: a.db })
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  expect(
    (
      await createAgencyInvoice(
        caller,
        { dealId, kind: 'monthly', period: '2026-11', dueOn: '2026-11-01' },
        { db: a.db }
      )
    ).amount_cents
  ).toBe(2500);
  await expect(
    saveAgencyTerms(
      caller,
      {
        dealId: a.seeded.a.dealId,
        currency: 'USD',
        setupCents: 100,
        monthlyCents: null,
        installments: []
      },
      { db: a.db }
    )
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
it('handles stub Stripe events, rejects live/replayed mutations and drafts reminders without delivery', async () => {
  const event = {
    id: 'evt_dev_fixture',
    livemode: false,
    created: 100,
    type: 'invoice.payment_failed',
    data: {
      object: {
        id: `in_dev_${invoice.id}`,
        livemode: false,
        currency: 'usd',
        amount_due: 5000,
        metadata: { agencyInvoiceId: invoice.id }
      }
    }
  };
  expect(await applyAgencyBillingWebhook(caller, event, { db: a.db })).toMatchObject({
    status: 'past_due',
    providerRequests: 0
  });
  expect(await applyAgencyBillingWebhook(caller, event, { db: a.db })).toMatchObject({
    duplicate: true
  });
  await expect(
    applyAgencyBillingWebhook(caller, { ...event, type: 'invoice.paid' }, { db: a.db })
  ).rejects.toMatchObject({ code: 'CONFLICT' });
  await expect(
    applyAgencyBillingWebhook(caller, { ...event, livemode: true }, { db: a.db })
  ).rejects.toThrow();
  expect(
    await draftAgencyDunning(caller, { db: a.db, now: new Date('2026-11-05T18:00:00Z') })
  ).toMatchObject({ drafted: 1, delivered: false, charged: false });
  expect(
    await draftAgencyDunning(caller, { db: a.db, now: new Date('2026-11-05T19:00:00Z') })
  ).toMatchObject({ drafted: 0 });
  expect(
    await applyAgencyBillingWebhook(
      caller,
      { ...event, id: 'evt_dev_paid', created: 101, type: 'invoice.paid' },
      { db: a.db }
    )
  ).toMatchObject({ status: 'paid' });
  expect(
    await applyAgencyBillingWebhook(
      caller,
      { ...event, id: 'evt_dev_stale', created: 99 },
      { db: a.db }
    )
  ).toMatchObject({ ignored: 'stale' });
  expect((await getAgencyBilling(caller, { db: a.db })).reminders).toHaveLength(0);
  expect(await a.test.admin`select id from messages where tenant_id=${a.tenantId}`).toHaveLength(0);
});
