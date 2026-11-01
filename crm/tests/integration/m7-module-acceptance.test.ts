import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { registerAutomationSubscribers } from '@/server/automations/worker';
import { registerAfterHoursSubscriber } from '@/server/automations/after-hours';
import { registerMissedCallTextbackSubscriber } from '@/server/automations/missed-call-textback';
import { registerStageRuleSubscribers } from '@/server/automations/rules';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { deliverNotificationEmail } from '@/server/notifications';
import { listAutomationTemplates, setAutomationEnabled } from '@/server/automations/service';
import { loadEnabledModules } from '@/server/modules';
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
  it('F-31: automation toggle refuses a disabled module and stops active runs when disabled', async () => {
    const [template] = await tdb.admin`insert into automation_templates (key, module_key, label)
      values ('quote_followup', 'quote_followup', 'Quote follow-up') on conflict (key) do update set label = excluded.label returning key`;
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'quote_followup', false)
      on conflict (tenant_id, module_key) do update set enabled = false`;
    expect(await listAutomationTemplates({ tenantId: IDS.tenantA, role: 'system' }, { db: worker })).not.toContainEqual(expect.objectContaining({ key: 'quote_followup' }));
    const owner = { userId: IDS.ownerA, kyneticRole: null, membership: { tenantId: IDS.tenantA, role: 'owner' as const, canExport: true, canBulkDelete: true }, viewAs: null };
    const disabledModules = await loadEnabledModules({ tenantId: IDS.tenantA, role: 'system' }, { db: worker });
    await expect(setAutomationEnabled({ tenantId: IDS.tenantA, role: 'owner', userId: IDS.ownerA }, owner, template!.key as 'quote_followup', true, disabledModules, { db: worker })).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
    await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'quote_followup'`;
    expect(await listAutomationTemplates({ tenantId: IDS.tenantA, role: 'system' }, { db: worker })).toContainEqual(expect.objectContaining({ key: 'quote_followup' }));
    const enabledModules = await loadEnabledModules({ tenantId: IDS.tenantA, role: 'system' }, { db: worker });
    const automation = await setAutomationEnabled({ tenantId: IDS.tenantA, role: 'owner', userId: IDS.ownerA }, owner, template!.key as 'quote_followup', true, enabledModules, { db: worker });
    const [run] = await tdb.admin`insert into automation_runs (tenant_id, automation_id, contact_id, next_run_at)
      values (${IDS.tenantA}, ${automation.id}, ${a!.contactId}, now()) returning id`;
    await setAutomationEnabled({ tenantId: IDS.tenantA, role: 'owner', userId: IDS.ownerA }, owner, template!.key as 'quote_followup', false, enabledModules, { db: worker });
    const [stopped] = await tdb.admin`select status, stop_reason from automation_runs where id = ${run!.id}`;
    expect(stopped).toMatchObject({ status: 'stopped_module_off', stop_reason: 'template_disabled' });
    expect(await listAutomationTemplates({ tenantId: IDS.tenantA, role: 'system' }, { db: worker })).toContainEqual(expect.objectContaining({ key: 'quote_followup' }));
  });

  it('F-79: quoted-stage event enrolls once when quote_followup is on and no-ops when off', async () => {
    const [quoted] = await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
      values (${IDS.tenantA}, ${a!.pipelineId}, 'Quoted', 1) returning id`;
    const [sequence] = await tdb.admin`insert into automations (tenant_id, kind, template_key, name, enabled)
      values (${IDS.tenantA}, 'template', 'quote_followup', 'Synthetic quote follow-up', true)
      on conflict (tenant_id, template_key) where kind = 'template' do update set enabled = true returning id`;
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
    const runs = await tdb.admin`select id from automation_runs where tenant_id = ${IDS.tenantA} and automation_id = ${sequence!.id} and status = 'active'`;
    expect(runs).toHaveLength(1);
    const jobs = await tdb.admin`select id from pgboss.job where name = 'automation.step' and data->>'runId' = ${runs[0]!.id}`;
    expect(jobs).toHaveLength(1);
    await expect(deliver(event('message.received', { contactId: a!.contactId }), 'automation-stop-message.received')).resolves.toBe('ran');
    const [stopped] = await tdb.admin`select status, stop_reason from automation_runs where id = ${runs[0]!.id}`;
    expect(stopped).toMatchObject({ status: 'stopped_reply', stop_reason: 'reply' });
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

  it('F-33 M13-06: booking moves only its tenant deal to the default Estimate Booked stage; replay is a no-op', async () => {
    clearSubscribers();
    registerStageRuleSubscribers();
    const [target] = await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
      values (${IDS.tenantA}, ${a.pipelineId}, 'Estimate Booked', 3) returning id`;
    // A legacy name must not take priority over the PRD's default stage.
    await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
      values (${IDS.tenantA}, ${a.pipelineId}, 'Booked', 2)`;
    const [appointment] = await tdb.admin`insert into appointments (tenant_id, contact_id, deal_id, starts_at, ends_at, booked_by)
      values (${IDS.tenantA}, ${a.contactId}, ${a.dealId}, '2026-11-02T18:00:00Z', '2026-11-02T19:00:00Z', 'alex') returning id`;
    const env = event('appointment.booked', { appointmentId: appointment!.id });
    // A forged event for the other tenant cannot see or move A's appointment/deal.
    await deliver({ ...env, tenantId: IDS.tenantB }, 'm7-booking-stage-rule');
    const [unchanged] = await tdb.admin`select stage_id from deals where id = ${a.dealId}`;
    expect(unchanged!.stage_id).toBe(a.stageId);
    await deliver(env, 'm7-booking-stage-rule');
    const [moved] = await tdb.admin`select stage_id, updated_at from deals where id = ${a.dealId}`;
    expect(moved!.stage_id).toBe(target!.id);
    await deliver(env, 'm7-booking-stage-rule');
    const [replayed] = await tdb.admin`select stage_id, updated_at from deals where id = ${a.dealId}`;
    expect(replayed).toEqual(moved);
    clearSubscribers();
  });

  it('F-33: deal-won alert creates one owner notification and emails once through the fake adapter', async () => {
    registerStageRuleSubscribers();
    const env = event('deal.won', { dealId: a!.dealId });
    await expect(deliver(env, 'm7-deal-won-alert')).resolves.toBe('ran');
    await expect(deliver(env, 'm7-deal-won-alert')).resolves.toBe('ran');
    const rows = await tdb.admin`select id from notifications where tenant_id = ${IDS.tenantA} and kind = 'deal_won' and link = ${`/dashboard/deals/${a!.dealId}`}`;
    expect(rows).toHaveLength(1);
    const jobs = await tdb.admin`select id from pgboss.job where name = 'notification.email' and data->>'notificationId' = ${rows[0]!.id}`;
    expect(jobs).toHaveLength(1);
    const mail = new FakeEmailProvider();
    await deliverNotificationEmail({ tenantId: IDS.tenantA, notificationId: rows[0]!.id }, {
      db: worker, provider: mail, fromAddress: 'alerts@example.test', baseUrl: 'https://portal.example.test'
    });
    await deliverNotificationEmail({ tenantId: IDS.tenantA, notificationId: rows[0]!.id }, {
      db: worker, provider: mail, fromAddress: 'alerts@example.test', baseUrl: 'https://portal.example.test'
    });
    expect(mail.sent).toHaveLength(1);
    expect(mail.sent[0]!.to).toBe('owner-a@example.test');
  });
});
