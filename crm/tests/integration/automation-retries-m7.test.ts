import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ProviderError } from '@/server/adapters/errors';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import type { SendSmsInput } from '@/server/adapters/sms/types';
import { recordConsent } from '@/server/consent';
import { createDb, type Db } from '@/server/db/client';
import { automationRuns, messages } from '@/server/db/schema';
import { deliverAutomationStep, registerAutomationSubscribers } from '@/server/automations/worker';
import { launchReactivation } from '@/server/automations/reactivation';
import { setFollowupBundle, type ModuleActor } from '@/server/modules/admin';
import { contacts } from '@/server/db/schema';
import { isModuleEnabled } from '@/server/modules';
import { canContact } from '@/server/consent';
import { clearSubscribers, deliver, type EventEnvelope } from '@/server/events';
import { stopJobs } from '@/server/jobs';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

const system = { tenantId: IDS.tenantA, role: 'system' as const };
const MIDDAY = new Date('2026-10-26T19:00:00Z');

class FlakySms extends FakeSmsProvider {
  attempts = 0;
  override async send(input: SendSmsInput) {
    this.attempts += 1;
    if (this.attempts === 1) throw new ProviderError('transient', 'http_503', 'synthetic outage');
    return super.send(input);
  }
}

let tdb: TestDatabase;
let db: Db;
let contactId: string;
let automationId: string;
let tenantBContactId: string;
let tenantBAutomationId: string;
const admin: ModuleActor = { id: IDS.admin, kyneticRole: 'admin' };

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  const { a, b } = await seedTwoTenants(tdb.admin);
  contactId = a.contactId;
  automationId = a.automationId;
  tenantBContactId = b.contactId;
  tenantBAutomationId = b.automationId;
  db = createDb(tdb.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real',
    OUTBOUND_ENABLED: 'true'
  });
  (globalThis as typeof globalThis & { __kyneticDb?: Db; __kyneticWorkerDb?: Db }).__kyneticDb = db;
  (globalThis as typeof globalThis & { __kyneticDb?: Db; __kyneticWorkerDb?: Db }).__kyneticWorkerDb = createDb(tdb.worker);
  await tdb.admin`update automations set enabled = true where id = ${automationId}`;
  await tdb.admin`update phone_numbers set a2p_status = 'approved' where tenant_id = ${IDS.tenantA}`;
  await recordConsent(ctx.ownerA(), {
    contactId,
    channel: 'sms',
    source: 'form',
    capturedText: 'Synthetic test consent',
    capturedAt: new Date('2026-10-01T00:00:00Z')
  }, { db });
});

afterAll(async () => {
  clearSubscribers();
  await stopJobs();
  const globals = globalThis as typeof globalThis & { __kyneticDb?: Db; __kyneticWorkerDb?: Db };
  delete globals.__kyneticDb;
  delete globals.__kyneticWorkerDb;
  delete process.env.OUTBOUND_ENABLED;
  await tdb?.drop();
});

async function newRun() {
  const [run] = await tdb.admin`insert into automation_runs
    (tenant_id, automation_id, contact_id, next_run_at)
    values (${IDS.tenantA}, ${automationId}, ${contactId}, now()) returning id`;
  return run!.id as string;
}

async function runStatus(runId: string) {
  const [run] = await withTenant(system, (tx) => tx.select().from(automationRuns).where(eq(automationRuns.id, runId)), { db });
  return run!;
}

describe('M7 automation module and retry acceptance', () => {
  it('stops only the replying tenant contact sequence on message.received', async () => {
    const [runA] = await tdb.admin`insert into automation_runs
      (tenant_id, automation_id, contact_id, next_run_at)
      values (${IDS.tenantA}, ${automationId}, ${contactId}, now()) returning id`;
    const [runB] = await tdb.admin`insert into automation_runs
      (tenant_id, automation_id, contact_id, next_run_at)
      values (${IDS.tenantB}, ${tenantBAutomationId}, ${tenantBContactId}, now()) returning id`;
    registerAutomationSubscribers();
    const event: EventEnvelope = {
      id: crypto.randomUUID(),
      name: 'message.received',
      version: 1,
      tenantId: IDS.tenantA,
      occurredAt: MIDDAY.toISOString(),
      actor: { type: 'system' },
      payload: { contactId }
    };

    await expect(deliver(event, 'automation-stop-message.received')).resolves.toBe('ran');
    expect(await runStatus(runA!.id)).toMatchObject({ status: 'stopped_reply', stopReason: 'reply' });
    const [tenantBRun] = await tdb.admin`select status, stop_reason from automation_runs where id = ${runB!.id}`;
    expect(tenantBRun).toMatchObject({ status: 'active', stop_reason: null });
  });

  it('stops the active sequence when the contact books an appointment', async () => {
    const [run] = await tdb.admin`insert into automation_runs
      (tenant_id, automation_id, contact_id, next_run_at)
      values (${IDS.tenantA}, ${automationId}, ${contactId}, now()) returning id`;
    clearSubscribers();
    registerAutomationSubscribers();
    const event: EventEnvelope = {
      id: crypto.randomUUID(),
      name: 'appointment.booked',
      version: 1,
      tenantId: IDS.tenantA,
      occurredAt: MIDDAY.toISOString(),
      actor: { type: 'system' },
      payload: { contactId }
    };

    await expect(deliver(event, 'automation-stop-appointment.booked')).resolves.toBe('ran');
    expect(await runStatus(run!.id)).toMatchObject({ status: 'stopped_booked', stopReason: 'booked' });
  });

  it('enables all follow-up bundle modules atomically and rolls them back together', async () => {
    await setFollowupBundle(admin, { tenantId: IDS.tenantA, enabled: true }, { db });
    for (const key of ['followup_bundle', 'quote_followup', 'reactivation', 'missed_call_textback'] as const)
      expect(await isModuleEnabled(system, key, { db })).toBe(true);
    const rows = await tdb.admin`select action, after from audit_log where tenant_id = ${IDS.tenantA} and action = 'module.toggle' order by created_at desc limit 4`;
    expect(rows).toHaveLength(4);
    await setFollowupBundle(admin, { tenantId: IDS.tenantA, enabled: false }, { db });
    for (const key of ['followup_bundle', 'quote_followup', 'reactivation', 'missed_call_textback'] as const)
      expect(await isModuleEnabled(system, key, { db })).toBe(false);
  });

  it('reactivation only enrolls imported contacts with valid SMS consent', async () => {
    await tdb.admin`insert into automation_templates (key, module_key, label) values ('reactivation', 'reactivation', 'Reactivation') on conflict do nothing`;
    const [sequence] = await tdb.admin`insert into automations (tenant_id, kind, template_key, name, enabled)
      values (${IDS.tenantA}, 'template', 'reactivation', 'Synthetic reactivation', true) returning id`;
    await tdb.admin`insert into automation_steps (tenant_id, automation_id, position, channel, body)
      values (${IDS.tenantA}, ${sequence!.id}, 1, 'sms', 'Synthetic reactivation')`;
    await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'reactivation', false)
      on conflict (tenant_id, module_key) do update set enabled = false`;
    const [eligible] = await tdb.admin`insert into contacts (tenant_id, first_name, primary_phone_e164, phones, imported_source)
      values (${IDS.tenantA}, 'Imported eligible', '+15555550801', ARRAY['+15555550801'], 'synthetic-import') returning id`;
    const [blocked] = await tdb.admin`insert into contacts (tenant_id, first_name, primary_phone_e164, phones, imported_source)
      values (${IDS.tenantA}, 'Imported no consent', '+15555550802', ARRAY['+15555550802'], 'synthetic-import') returning id`;
    await recordConsent(ctx.ownerA(), { contactId: eligible!.id, channel: 'sms', source: 'form', capturedText: 'Synthetic consent', capturedAt: new Date('2026-10-01T00:00:00Z') }, { db });

    await expect(launchReactivation(ctx.ownerA(), { userId: IDS.ownerA, kyneticRole: null, membership: { tenantId: IDS.tenantA, role: 'owner', canExport: true, canBulkDelete: true }, viewAs: null }, { importedSource: 'synthetic-import' }, { db, now: MIDDAY })).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
    expect(await tdb.admin`select id from reactivation_batches where tenant_id = ${IDS.tenantA} and created_by = ${IDS.ownerA}`).toHaveLength(0);
    await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'reactivation'`;
    const result = await launchReactivation(ctx.ownerA(), { userId: IDS.ownerA, kyneticRole: null, membership: { tenantId: IDS.tenantA, role: 'owner', canExport: true, canBulkDelete: true }, viewAs: null }, { importedSource: 'synthetic-import' }, { db, now: MIDDAY });
    expect(result).toMatchObject({ requested: 2, eligible: 1, enrolled: 1, blocked: 1 });
    const active = await tdb.admin`select contact_id from automation_runs where tenant_id = ${IDS.tenantA} and automation_id = ${sequence!.id} and status = 'active'`;
    expect(active).toEqual([{ contact_id: eligible!.id }]);
    expect(await canContact(system, blocked!.id, 'sms', MIDDAY, { db })).toMatchObject({ allowed: false });
  });

  it('stops an active run before sending when the template module is disabled', async () => {
    const runId = await newRun();
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    const provider = new FakeSmsProvider();
    try {
      await deliverAutomationStep({ tenantId: IDS.tenantA, runId }, { provider, now: MIDDAY });
      expect(provider.sent).toHaveLength(0);
      expect(await runStatus(runId)).toMatchObject({ status: 'stopped_module_off', stopReason: 'module_disabled', nextRunAt: null });
    } finally {
      await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    }
  });

  it('keeps a transient failure active for queue retry, then completes once on fake provider success', async () => {
    const runId = await newRun();
    const provider = new FlakySms();
    const sentBefore = await withTenant(system, (tx) => tx.select().from(messages).where(eq(messages.contactId, contactId)), { db });
    await expect(deliverAutomationStep({ tenantId: IDS.tenantA, runId }, { provider, now: MIDDAY })).rejects.toMatchObject({ kind: 'transient' });
    expect(await runStatus(runId)).toMatchObject({ status: 'active', currentStep: 1 });
    await deliverAutomationStep({ tenantId: IDS.tenantA, runId }, { provider, now: MIDDAY });
    expect(provider.attempts).toBe(2);
    expect(provider.sent).toHaveLength(1);
    expect(await runStatus(runId)).toMatchObject({ status: 'completed', currentStep: 2 });
    await deliverAutomationStep({ tenantId: IDS.tenantA, runId }, { provider, now: MIDDAY });
    expect(provider.sent).toHaveLength(1);
    const rows = await withTenant(system, (tx) => tx.select().from(messages).where(eq(messages.contactId, contactId)), { db });
    expect(rows.filter((message) => message.status === 'sent')).toHaveLength(
      sentBefore.filter((message) => message.status === 'sent').length + 1
    );
  });

  it('atomically defers quiet-hour work and ignores an early redelivery', async () => {
    const runId = await newRun();
    const late = new Date('2026-10-27T05:00:00Z');
    const provider = new FakeSmsProvider();
    await deliverAutomationStep({ tenantId: IDS.tenantA, runId }, { provider, now: late });
    const deferred = await runStatus(runId);
    expect(deferred.status).toBe('active');
    expect(new Date(deferred.nextRunAt!).getTime()).toBeGreaterThan(late.getTime());
    await deliverAutomationStep({ tenantId: IDS.tenantA, runId }, { provider, now: late });
    expect(provider.sent).toHaveLength(0);
  });
});
