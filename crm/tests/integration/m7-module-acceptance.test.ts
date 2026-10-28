import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { registerAutomationSubscribers } from '@/server/automations/worker';
import { registerAfterHoursSubscriber } from '@/server/automations/after-hours';
import { registerMissedCallTextbackSubscriber } from '@/server/automations/missed-call-textback';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let worker: Db;
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
const at = new Date('2026-10-28T19:00:00.000Z');
const event = (name: string, payload: Record<string, unknown>, tenantId = IDS.tenantA): EventEnvelope => ({
  id: crypto.randomUUID(), name, version: 1, tenantId, occurredAt: at.toISOString(),
  actor: { type: 'system' }, payload
});

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(tdb.admin));
  worker = createDb(tdb.worker);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000', DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker, DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real', OUTBOUND_ENABLED: 'true'
  });
  Object.assign(globalThis as typeof globalThis & { __kyneticWorkerDb?: Db }, { __kyneticWorkerDb: worker });
});

afterAll(async () => {
  clearSubscribers();
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticWorkerDb?: Db }).__kyneticWorkerDb;
  delete process.env.OUTBOUND_ENABLED;
  await tdb?.drop();
});

describe('M7 F-79/F-80/F-81 module acceptance', () => {
  it('F-79: quoted-stage event enrolls once when quote_followup is on and no-ops when off', async () => {
    const [quoted] = await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
      values (${IDS.tenantA}, ${a!.pipelineId}, 'Quoted', 1) returning id`;
    const [sequence] = await tdb.admin`insert into automations (tenant_id, kind, template_key, name, enabled)
      values (${IDS.tenantA}, 'template', 'quote_followup', 'Synthetic quote follow-up', true) returning id`;
    await tdb.admin`insert into automation_templates (key, module_key, label)
      values ('quote_followup', 'quote_followup', 'Synthetic quote follow-up') on conflict do nothing`;
    await tdb.admin`insert into automation_steps (tenant_id, automation_id, position, channel, body)
      values (${IDS.tenantA}, ${sequence!.id}, 1, 'sms', 'Synthetic follow-up')`;
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'quote_followup', false)
      on conflict (tenant_id, module_key) do update set enabled = false`;
    registerAutomationSubscribers();
    const env = event('deal.stage_changed', { toStageId: quoted!.id, contactId: a!.contactId });
    await expect(deliver(env, 'automation-quote-followup')).resolves.toBe('skipped');
    await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'quote_followup'`;
    await expect(deliver(env, 'automation-quote-followup')).resolves.toBe('ran');
    await expect(deliver(env, 'automation-quote-followup')).resolves.toBe('ran');
    const runs = await tdb.admin`select id from automation_runs where tenant_id = ${IDS.tenantA} and automation_id = ${sequence!.id}`;
    expect(runs).toHaveLength(1);
    const jobs = await tdb.admin`select id from pgboss.job where name = 'automation.step' and data->>'runId' = ${runs[0]!.id}`;
    expect(jobs).toHaveLength(1);
  });

  it('F-80: after-hours inbound completion notifies once and module-off delivery no-ops', async () => {
    await tdb.admin`update tenants set business_hours = ${tdb.admin.json({ tue: [{ open: '08:00', close: '17:00' }] })} where id = ${IDS.tenantA}`;
    const [call] = await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, outcome)
      values (${IDS.tenantA}, ${a!.contactId}, 'fake', 'f80-after-hours', 'inbound', '2026-10-28T05:00:00Z', 'no_answer') returning id`;
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'after_hours', false)
      on conflict (tenant_id, module_key) do update set enabled = false`;
    registerAfterHoursSubscriber();
    const env = event('call.completed', { direction: 'inbound', callId: call!.id, startedAt: '2026-10-28T05:00:00Z' });
    await expect(deliver(env, 'after-hours-call-alert')).resolves.toBe('skipped');
    await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'after_hours'`;
    await expect(deliver(env, 'after-hours-call-alert')).resolves.toBe('ran');
    await expect(deliver(env, 'after-hours-call-alert')).resolves.toBe('ran');
    const rows = await tdb.admin`select id from notifications where tenant_id = ${IDS.tenantA} and kind = 'action_needed' and link = ${`/dashboard/calls/${call!.id}`}`;
    expect(rows).toHaveLength(1);
  });

  it('F-81: missed-call text-back sends one fake SMS with consent and none without consent', async () => {
    const provider = new FakeSmsProvider();
    await tdb.admin`update phone_numbers set a2p_status = 'approved' where tenant_id = ${IDS.tenantA}`;
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'missed_call_textback', true)
      on conflict (tenant_id, module_key) do update set enabled = true`;
    const [consentedCall] = await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, outcome)
      values (${IDS.tenantA}, ${a!.contactId}, 'fake', 'f81-consented', 'inbound', ${at.toISOString()}, 'no_answer') returning id`;
    const [noConsent] = await tdb.admin`insert into contacts (tenant_id, first_name, phones, primary_phone_e164)
      values (${IDS.tenantA}, 'Synthetic no consent', ARRAY['+15555550891'], '+15555550891') returning id`;
    const [blockedCall] = await tdb.admin`insert into calls (tenant_id, contact_id, provider, provider_call_id, direction, started_at, outcome)
      values (${IDS.tenantA}, ${noConsent!.id}, 'fake', 'f81-blocked', 'inbound', ${at.toISOString()}, 'no_answer') returning id`;
    registerMissedCallTextbackSubscriber({ db: worker, provider, now: () => at });
    const consentedEvent = event('call.completed', { direction: 'inbound', outcome: 'no_answer', callId: consentedCall!.id });
    await expect(deliver(consentedEvent, 'missed-call-textback')).resolves.toBe('ran');
    expect(provider.sent).toHaveLength(1);
    const blockedEvent = event('call.completed', { direction: 'inbound', outcome: 'no_answer', callId: blockedCall!.id });
    await expect(deliver(blockedEvent, 'missed-call-textback')).resolves.toBe('ran');
    expect(provider.sent).toHaveLength(1);
    const logged = await tdb.admin`select status from messages where tenant_id = ${IDS.tenantA} and contact_id = ${a!.contactId} and body like 'Sorry we missed your call%'`;
    expect(logged).toEqual([{ status: 'sent' }]);
  });
});
