import { beforeAll, afterAll, it, expect } from 'vitest';
import { setupAgency, agencyAdmin as caller } from '../helpers/agency';
import { createAgencyLead } from '@/server/agency';
import { createAgencyCampaign, assignAgencyCampaign } from '@/server/agency/campaigns';
import {
  setAgencyCampaignPlan,
  startAgencyCampaign,
  advanceAgencyCampaign,
  agencyCampaignStats
} from '@/server/agency/campaign-engine';
let a: Awaited<ReturnType<typeof setupAgency>>, campaignId: string, contactId: string;
const now = new Date('2026-11-05T18:00:00Z');
beforeAll(async () => {
  a = await setupAgency();
  contactId = (
    await createAgencyLead(
      caller,
      {
        firstName: 'DEV Sequence',
        email: 'sequence@example.test',
        direction: 'outbound',
        channel: 'email'
      },
      { db: a.db }
    )
  ).contactId;
  campaignId = (
    await createAgencyCampaign(
      caller,
      { name: 'DEV Sequence', script: 'Synthetic manual tasks' },
      { db: a.db }
    )
  ).id;
  await assignAgencyCampaign(caller, campaignId, contactId, { db: a.db });
});
afterAll(async () => {
  await a?.close();
});
it('runs due steps in stub mode, persists stats, deduplicates and never sends', async () => {
  const opts = { db: a.db, now };
  await setAgencyCampaignPlan(
    caller,
    campaignId,
    [
      { channel: 'call', delayDays: 0, instructions: 'Log a manual call' },
      { channel: 'email', delayDays: 2, instructions: 'Review email draft' }
    ],
    opts
  );
  expect(await startAgencyCampaign(caller, campaignId, opts)).toMatchObject({
    enrolled: 1,
    providerRequests: 0
  });
  expect(await startAgencyCampaign(caller, campaignId, opts)).toMatchObject({ enrolled: 0 });
  const input = { campaignId, contactId, stepIndex: 0, mode: 'simulate' };
  expect(await advanceAgencyCampaign(caller, input, opts)).toMatchObject({
    status: 'active',
    providerRequests: 0
  });
  expect(await advanceAgencyCampaign(caller, input, opts)).toMatchObject({ duplicate: true });
  expect(await advanceAgencyCampaign(caller, { ...input, stepIndex: 1 }, opts)).toMatchObject({
    status: 'not_due'
  });
  expect(await agencyCampaignStats(caller, campaignId, opts)).toEqual([
    { result: 'simulated', count: 1 }
  ]);
  expect(await a.test.admin`select id from messages where tenant_id=${a.tenantId}`).toHaveLength(0);
  expect(await a.test.admin`select id from calls where tenant_id=${a.tenantId}`).toHaveLength(0);
  await expect(
    setAgencyCampaignPlan(
      caller,
      campaignId,
      [{ channel: 'sms', delayDays: 0, instructions: 'replace' }],
      opts
    )
  ).rejects.toMatchObject({ code: 'CONFLICT' });
});
it('rechecks replies before advancing a due manual task', async () => {
  await a.test
    .admin`insert into agency_dm_logs(tenant_id,contact_id,direction,platform,body,logged_by,occurred_at) values(${a.tenantId},${contactId},'inbound','DEV','reply',${caller.id},'2026-11-06T18:00:00Z')`;
  expect(
    await advanceAgencyCampaign(
      caller,
      { campaignId, contactId, stepIndex: 1, mode: 'manual_complete' },
      { db: a.db, now: new Date('2026-11-08T18:00:00Z') }
    )
  ).toMatchObject({ status: 'stopped', reason: 'replied', providerRequests: 0 });
});
