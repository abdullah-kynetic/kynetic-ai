import { afterAll, beforeAll, it, expect } from 'vitest';
import { setupAgency, agencyAdmin as caller } from '../helpers/agency';
import { IDS } from '../helpers/fixtures';
import { createAgencyLead } from '@/server/agency';
import { listAgencyInbox, logAgencyDm, getAgencyRates } from '@/server/agency/inbox';
let a: Awaited<ReturnType<typeof setupAgency>>, contactId: string;
beforeAll(async () => {
  a = await setupAgency();
  contactId = (
    await createAgencyLead(
      caller,
      { firstName: 'DEV Inbox', email: 'inbox@example.test', direction: 'inbound', channel: 'dm' },
      { db: a.db }
    )
  ).contactId;
});
afterAll(async () => {
  await a?.close();
});
it('filters actual SMS/email/manual DM by channel/status and isolates tenants', async () => {
  await logAgencyDm(
    caller,
    { contactId, direction: 'outbound', platform: 'LinkedIn', body: 'DEV prospect outreach log' },
    { db: a.db }
  );
  await logAgencyDm(
    caller,
    { contactId, direction: 'inbound', platform: 'LinkedIn', body: 'DEV reply log' },
    { db: a.db }
  );
  await a.test
    .admin`insert into messages(tenant_id,contact_id,channel,direction,actor_type,from_address,to_address,body,status) values(${a.tenantId},${contactId},'sms','inbound','system','fixture','fixture','DEV inbound','received'),(${a.tenantId},${contactId},'email','outbound','user','fixture','fixture','DEV email','failed')`;
  expect(
    await listAgencyInbox(caller, { channel: 'dm', status: 'logged' }, { db: a.db })
  ).toHaveLength(2);
  expect(
    await listAgencyInbox(caller, { channel: 'sms', status: 'received' }, { db: a.db })
  ).toHaveLength(1);
  expect(
    await listAgencyInbox(caller, { channel: 'email', status: 'sent' }, { db: a.db })
  ).toHaveLength(0);
  expect(
    (await listAgencyInbox(caller, {}, { db: a.db })).every((m) => m.contact_id === contactId)
  ).toBe(true);
  await expect(
    logAgencyDm(
      caller,
      {
        contactId: a.seeded.a.contactId,
        direction: 'inbound',
        platform: 'DEV',
        body: 'cross tenant'
      },
      { db: a.db }
    )
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  await expect(
    listAgencyInbox({ id: IDS.va, kyneticRole: 'va' }, {}, { db: a.db })
  ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  const rates = await getAgencyRates(caller, { db: a.db });
  expect(rates).toMatchObject({ contacted: 1, replied: 1, replyRate: 1, pickRate: null });
});
