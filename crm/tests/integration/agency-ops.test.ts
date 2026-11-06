import { beforeAll, afterAll, it, expect } from 'vitest';
import { createDb } from '@/server/db/client';
import { setupAgency, agencyAdmin as caller } from '../helpers/agency';
import { IDS } from '../helpers/fixtures';
import {
  agencyDigest,
  publishAgencyDigest,
  saveAgencyOps,
  getAgencyOps,
  rotateAgencySecret,
  agencySecretStatus,
  AGENCY_DIGEST_CRON,
  AGENCY_DIGEST_TZ
} from '@/server/agency/ops';
let a: Awaited<ReturnType<typeof setupAgency>>;
beforeAll(async () => {
  a = await setupAgency();
});
afterAll(async () => {
  await a?.close();
});
it('schedules Pacific digest and previews/publishes only in-app idempotently', async () => {
  const schedules = await a.test
    .admin`select cron,timezone from pgboss.schedule where name='agency.digest'`;
  expect(schedules).toEqual([{ cron: AGENCY_DIGEST_CRON, timezone: AGENCY_DIGEST_TZ }]);
  expect(await agencyDigest(caller, { db: a.db })).toMatchObject({
    delivered: false,
    summary: { clients: 3 }
  });
  const opts = { db: a.db, now: new Date('2026-11-05T16:00:00Z') };
  const job = { tenantId: a.tenantId, requestedBy: caller.id };
  await publishAgencyDigest(job, opts);
  await publishAgencyDigest(job, opts);
  expect(await a.test.admin`select id from agency_alerts where kind='daily_digest'`).toHaveLength(
    1
  );
  expect(
    await a.test.admin`select id from pgboss.job where name='notification.email'`
  ).toHaveLength(0);
  await expect(publishAgencyDigest({ ...job, requestedBy: IDS.va }, opts)).rejects.toMatchObject({
    code: 'FORBIDDEN'
  });
});
it('stores inert DEV binding only and rotates agency-only encrypted secret with masked reads', async () => {
  const input = {
    devWebhookUrl: `https://dev.kyneticai.com/api/hooks/leads/${a.tenantId}`,
    workflowName: 'DEV - Agency draft',
    workflowId: 'DEV-fixture'
  };
  await saveAgencyOps(caller, input, { db: a.db });
  expect((await getAgencyOps(caller, { db: a.db })).settings?.workflow_name).toBe(
    input.workflowName
  );
  await expect(
    saveAgencyOps(
      caller,
      { ...input, devWebhookUrl: 'https://portal.kyneticai.com/api/hooks/leads/live' },
      { db: a.db }
    )
  ).rejects.toThrow();
  await expect(
    saveAgencyOps(caller, { ...input, workflowName: 'Live workflow' }, { db: a.db })
  ).rejects.toThrow();
  const opts = { db: a.db, secretDb: createDb(a.test.worker) };
  expect(await rotateAgencySecret(caller, opts)).toEqual({ rotated: true });
  expect(await agencySecretStatus(caller, opts)).toMatchObject({
    isSet: true,
    tenantId: a.tenantId
  });
  expect(
    await a.test.admin`select tenant_id from tenant_secrets where provider='lead_webhook'`
  ).toEqual([{ tenant_id: a.tenantId }]);
});
