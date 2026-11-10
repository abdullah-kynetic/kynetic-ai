import { afterAll, beforeAll, expect, it } from 'vitest';
import { setupAgency, agencyAdmin as caller } from '../helpers/agency';
import { createAgencyLead } from '@/server/agency';
import { createAgencyInvoice, draftAgencyDunning, saveAgencyTerms } from '@/server/agency/billing';
import { previewAgencyMessage, saveAgencyMessage } from '@/server/agency/messaging';
import { resetEnvCacheForTests } from '@/server/env';

let a: Awaited<ReturnType<typeof setupAgency>>;

beforeAll(async () => {
  a = await setupAgency();
});

afterAll(async () => {
  process.env.PROVIDER_MODE = 'stub';
  process.env.OUTBOUND_ENABLED = 'false';
  resetEnvCacheForTests();
  await a?.close();
});

it('saves billing drafts and previews gates when provider mode is live', async () => {
  process.env.PROVIDER_MODE = 'live';
  process.env.OUTBOUND_ENABLED = 'false';
  resetEnvCacheForTests();
  const lead = await createAgencyLead(
    caller,
    {
      firstName: 'DEV Live Mode',
      email: 'live-mode@example.test',
      direction: 'inbound',
      channel: 'form',
      state: 'CA'
    },
    { db: a.db }
  );
  await saveAgencyTerms(
    caller,
    {
      dealId: lead.dealId,
      currency: 'USD',
      setupCents: 2500,
      monthlyCents: null,
      installments: []
    },
    { db: a.db }
  );
  const invoice = await createAgencyInvoice(
    caller,
    { dealId: lead.dealId, kind: 'setup', installment: 0, dueOn: '2026-12-01' },
    { db: a.db }
  );
  expect(invoice.amount_cents).toBe(2500);
  await a.test.admin`
    update agency_invoice_drafts set status = 'open', due_on = '2026-11-01' where id = ${invoice.id}`;
  expect(
    await draftAgencyDunning(caller, { db: a.db, now: new Date('2026-11-10T18:00:00Z') })
  ).toMatchObject({ drafted: 1, delivered: false, charged: false });
  const draft = await saveAgencyMessage(
    caller,
    { contactId: lead.contactId, channel: 'sms', body: 'Gate check only' },
    { db: a.db }
  );
  await expect(
    previewAgencyMessage(caller, draft.id, { db: a.db, now: new Date('2026-11-05T18:00:00Z') })
  ).resolves.toMatchObject({ status: 'blocked', reason: 'outbound_disabled' });
  expect(
    await a.test
      .admin`select id from messages where tenant_id = ${a.tenantId} and body = 'Gate check only'`
  ).toHaveLength(0);
});
