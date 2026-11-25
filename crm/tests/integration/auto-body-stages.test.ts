import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { onboardTenant } from '@/server/admin/onboarding';
import { registerAutomationSubscribers } from '@/server/automations/worker';
import { createDb, type Db } from '@/server/db/client';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let worker: Db;

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  worker = createDb(tdb.worker);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real',
    OUTBOUND_ENABLED: 'true'
  });
  Object.assign(globalThis as typeof globalThis & { __kyneticWorkerDb?: Db }, {
    __kyneticWorkerDb: worker
  });
});

afterAll(async () => {
  clearSubscribers();
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticWorkerDb?: Db }).__kyneticWorkerDb;
  delete process.env.OUTBOUND_ENABLED;
  await tdb?.drop();
});

describe('A-3 auto body stages and quote follow-up', () => {
  it('onboards an auto body shop onto the eight shop stages with Quoted second', async () => {
    const created = await onboardTenant(
      { userId: IDS.admin, role: 'admin' },
      {
        businessName: 'Stage Test Collision',
        ownerEmail: 'stages@example.test',
        phone: '2145550101',
        industry: 'auto_body',
        timezone: 'America/Chicago',
        hours: { days: ['mon'], open: '08:00', close: '17:00' },
        plan: 'founding'
      },
      { db: createDb(tdb.app) }
    );
    const stages =
      await tdb.admin`select name, is_won, is_lost from pipeline_stages where tenant_id = ${created.tenantId} order by position`;
    expect(stages.map((row) => row.name)).toEqual([
      'New lead',
      'Quoted',
      'Waiting on insurance',
      'Parts ordered',
      'In repair and paint',
      'Ready for pickup',
      'Picked up',
      'Lost'
    ]);
    expect(stages.find((row) => row.name === 'Picked up')).toMatchObject({ is_won: true });
    expect(stages.find((row) => row.name === 'Lost')).toMatchObject({ is_lost: true });

    // A deal entering the shop's own Quoted stage enrolls the contact in quote follow-up.
    const [quoted] =
      await tdb.admin`select id from pipeline_stages where tenant_id = ${created.tenantId} and name = 'Quoted'`;
    const [contact] =
      await tdb.admin`insert into contacts (tenant_id, first_name, last_name, primary_phone_e164, phones)
        values (${created.tenantId}, 'Test', 'Driver', '+12145550102', ${['+12145550102']}) returning id`;
    const [sequence] =
      await tdb.admin`insert into automations (tenant_id, kind, template_key, name, enabled)
        values (${created.tenantId}, 'template', 'quote_followup', 'Quote follow-up', true)
        on conflict (tenant_id, template_key) where kind = 'template' do update set enabled = true returning id`;
    await tdb.admin`insert into automation_steps (tenant_id, automation_id, position, channel, body)
      values (${created.tenantId}, ${sequence!.id}, 1, 'sms', 'Synthetic follow-up')`;
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled)
      values (${created.tenantId}, 'quote_followup', true)
      on conflict (tenant_id, module_key) do update set enabled = true`;
    registerAutomationSubscribers();
    const env: EventEnvelope = {
      id: crypto.randomUUID(),
      name: 'deal.stage_changed',
      version: 1,
      tenantId: created.tenantId,
      occurredAt: new Date().toISOString(),
      actor: { type: 'system' },
      payload: { toStageId: quoted!.id, contactId: contact!.id }
    };
    await expect(deliver(env, 'automation-quote-followup')).resolves.toBe('ran');
    const runs =
      await tdb.admin`select id from automation_runs where tenant_id = ${created.tenantId} and automation_id = ${sequence!.id} and status = 'active'`;
    expect(runs).toHaveLength(1);
  });
});
