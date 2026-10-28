import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { eq } from 'drizzle-orm';
import { ProviderError } from '@/server/adapters/errors';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import type { SendSmsInput } from '@/server/adapters/sms/types';
import { recordConsent } from '@/server/consent';
import { createDb, type Db } from '@/server/db/client';
import { automationRuns, messages } from '@/server/db/schema';
import { deliverAutomationStep } from '@/server/automations/worker';
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

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  const { a } = await seedTwoTenants(tdb.admin);
  contactId = a.contactId;
  automationId = a.automationId;
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
