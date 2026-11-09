import { beforeAll, afterAll, it, expect } from 'vitest';
import { setupAgency, agencyAdmin as caller } from '../helpers/agency';
import { createAgencyLead } from '@/server/agency';
import { saveAgencyMessage, previewAgencyMessage } from '@/server/agency/messaging';
let a: Awaited<ReturnType<typeof setupAgency>>, id: string, contactId: string;
const open = new Date('2026-11-05T18:00:00Z');
beforeAll(async () => {
  a = await setupAgency();
  contactId = (
    await createAgencyLead(
      caller,
      {
        firstName: 'DEV Compose',
        email: 'compose@example.test',
        phone: '+12025550106',
        direction: 'outbound',
        channel: 'sms',
        state: 'CA'
      },
      { db: a.db }
    )
  ).contactId;
  id = (
    await saveAgencyMessage(
      caller,
      { contactId, channel: 'sms', body: 'Synthetic preview only' },
      { db: a.db }
    )
  ).id;
  await a.test.admin`update tenants set timezone='America/Los_Angeles' where id=${a.tenantId}`;
  await a.test
    .admin`insert into tenant_modules(tenant_id,module_key,enabled) values(${a.tenantId},'alex_core',true)`;
  await a.test
    .admin`insert into phone_numbers(tenant_id,e164,provider,provider_sid,purpose,a2p_status) values(${a.tenantId},'+12025550107','twilio','DEV-stub','sms','approved')`;
  await a.test.admin`update alex_configs set paused=false where tenant_id=${a.tenantId}`;
});
afterAll(async () => {
  await a?.close();
});
it('global and tenant kill switches block without writing any sent message', async () => {
  expect(await previewAgencyMessage(caller, id, { db: a.db, now: open })).toMatchObject({
    status: 'blocked',
    reason: 'outbound_disabled'
  });
  expect(
    await previewAgencyMessage(caller, id, { db: a.db, now: open, outboundEnabledForTest: true })
  ).toMatchObject({ status: 'blocked', reason: 'outbound_disabled' });
  expect(await a.test.admin`select id from messages where tenant_id=${a.tenantId}`).toHaveLength(0);
});
it('server consent and quiet hours block; an allowed stub is idempotent', async () => {
  await a.test
    .admin`update tenant_modules set config='{}' where tenant_id=${a.tenantId} and module_key='platform'`;
  const opts = { db: a.db, now: open, outboundEnabledForTest: true };
  expect(await previewAgencyMessage(caller, id, opts)).toMatchObject({
    status: 'blocked',
    reason: 'no_consent'
  });
  await a.test
    .admin`insert into consents(tenant_id,contact_id,channel,kind,source,captured_text) values(${a.tenantId},${contactId},'sms','express_written','staff','DEV synthetic fixture, no real contact')`;
  expect(
    await previewAgencyMessage(caller, id, { ...opts, now: new Date('2026-11-05T10:00:00Z') })
  ).toMatchObject({ status: 'blocked', reason: 'quiet_hours' });
  expect(await a.test.admin`select id from messages where tenant_id=${a.tenantId}`).toHaveLength(0);
  expect(await previewAgencyMessage(caller, id, opts)).toMatchObject({
    status: 'simulated',
    result: { providerRequests: 0 }
  });
  expect(await previewAgencyMessage(caller, id, opts)).toMatchObject({
    status: 'simulated',
    duplicate: true
  });
  expect(await a.test.admin`select id from messages where tenant_id=${a.tenantId}`).toHaveLength(1);
  await expect(
    saveAgencyMessage(
      caller,
      { contactId: a.seeded.a.contactId, channel: 'email', body: 'other tenant' },
      { db: a.db }
    )
  ).rejects.toMatchObject({ code: 'NOT_FOUND' });
});

it('email also requires consent and respects quiet hours without an inbound reply bypass', async () => {
  const email = (
    await saveAgencyMessage(
      caller,
      { contactId, channel: 'email', subject: 'DEV', body: 'Synthetic email preview' },
      { db: a.db }
    )
  ).id;
  const opts = { db: a.db, now: open, outboundEnabledForTest: true };
  expect(await previewAgencyMessage(caller, email, opts)).toMatchObject({
    status: 'blocked',
    reason: 'no_consent'
  });
  await a.test
    .admin`insert into consents(tenant_id,contact_id,channel,kind,source,captured_text) values(${a.tenantId},${contactId},'email','express_written','staff','Synthetic email fixture only')`;
  expect(
    await previewAgencyMessage(caller, email, { ...opts, now: new Date('2026-11-05T10:00:00Z') })
  ).toMatchObject({ status: 'blocked', reason: 'quiet_hours' });
  expect(await previewAgencyMessage(caller, email, opts)).toMatchObject({
    status: 'simulated',
    result: { providerRequests: 0 }
  });
});
