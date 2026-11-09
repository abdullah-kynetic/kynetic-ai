import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  createAgencyLead,
  getAgencyWorkspace,
  listAgencyLeads,
  listAgencyAlerts
} from '@/server/agency';
import { runAgencyMaintenance, AGENCY_MAINTENANCE_CRON } from '@/server/agency/scheduling';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
let test: TestDatabase;
let db: Db;
let tenantId: string;
const caller = { id: IDS.admin, kyneticRole: 'admin' as const };
beforeAll(async () => {
  test = await createTestDatabase({ jobs: true });
  await seedTwoTenants(test.admin);
  db = createDb(test.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'https://dev.kyneticai.com',
    DATABASE_URL: test.urls.app,
    DATABASE_URL_WORKER: test.urls.worker,
    DATABASE_URL_AUTH: test.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32),
    PROVIDER_MODE: 'stub',
    OUTBOUND_ENABLED: 'false'
  });
  tenantId = (await getAgencyWorkspace(caller, true, { db }))!.tenantId;
});
afterAll(async () => {
  await stopJobs();
  await test?.drop();
});
describe('agency step 7', () => {
  it('new_lead is transactional/in-app only and source fields filter correctly', async () => {
    const lead = await createAgencyLead(
      caller,
      {
        firstName: 'DEV Agency',
        email: 'new-agency@example.test',
        direction: 'inbound',
        channel: 'form',
        state: 'CA'
      },
      { db }
    );
    const notifications =
      await test.admin`select kind from agency_alerts where tenant_id=${tenantId}`;
    expect(await listAgencyAlerts(caller, { db })).toHaveLength(1);
    await expect(listAgencyAlerts({ id: IDS.va, kyneticRole: 'va' }, { db })).rejects.toMatchObject(
      { code: 'FORBIDDEN' }
    );
    expect(notifications).toEqual([{ kind: 'new_lead' }]);
    const events =
      await test.admin`select data from pgboss.job where name='event.dispatch' and data->>'tenantId'=${tenantId} and data->>'name'='agency.lead.created'`;
    expect(events).toHaveLength(1);
    expect(events[0].data.payload.contactId).toBe(lead.contactId);
    expect(
      await test.admin`select id from pgboss.job where name in ('notification.email','call.outbound') and data->>'tenantId'=${tenantId}`
    ).toHaveLength(0);
    expect(
      (await listAgencyLeads(caller, { direction: 'inbound', channel: 'form' }, { db })).leads
    ).toHaveLength(1);
    expect((await listAgencyLeads(caller, { direction: 'outbound' }, { db })).leads).toHaveLength(
      0
    );
  });
  it('scheduled maintenance has one durable schedule and rebuilds metrics/report idempotently without delivery', async () => {
    await getAgencyWorkspace(caller, true, { db });
    const schedules =
      await test.admin`select cron, data from pgboss.schedule where name='agency.maintenance'`;
    expect(schedules).toHaveLength(1);
    expect(schedules[0].cron).toBe(AGENCY_MAINTENANCE_CRON);
    expect(schedules[0].data).toEqual({ tenantId });
    const opts = { db: createDb(test.worker), now: new Date('2026-11-05T18:00:00Z') };
    expect(await runAgencyMaintenance({ tenantId }, opts)).toMatchObject({
      delivered: false,
      reportPeriod: '2026-10-01'
    });
    await runAgencyMaintenance({ tenantId }, opts);
    expect(
      await test.admin`select day from metrics_daily where tenant_id=${tenantId}`
    ).toHaveLength(2);
    expect(await test.admin`select id from reports where tenant_id=${tenantId}`).toHaveLength(1);
    await expect(runAgencyMaintenance({ tenantId: IDS.tenantA }, opts)).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });
});
