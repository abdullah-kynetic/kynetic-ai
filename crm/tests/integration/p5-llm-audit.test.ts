import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { FakeLlmProvider } from '@/server/adapters/llm/fake';
import { setLlmProvider } from '@/server/adapters/llm';
import { decideLlmOutput, runLlmTask } from '@/server/llm';
import { resetEnvCacheForTests } from '@/server/env';
import { stopJobs } from '@/server/jobs';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let fake: FakeLlmProvider;
const ownerA = { tenantId: IDS.tenantA, userId: IDS.ownerA, role: 'owner' as const };
const run = (approval: 'pending' | 'not_required' = 'pending') =>
  runLlmTask(
    {
      tenantId: IDS.tenantA,
      task: 'message_draft',
      messages: [
        { role: 'system', content: 'draft a text' },
        { role: 'user', content: 'Contact: Pat Example' }
      ],
      subject: { type: 'contact', id: 'contact-1' },
      requestedBy: IDS.ownerA,
      approval
    },
    { db }
  );

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  db = createDb(tdb.app);
  Object.assign(process.env, {
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_AUTH: tdb.authUrl,
    APP_BASE_URL: 'http://localhost:3000',
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real',
    LLM_ENABLED: 'true',
    PROVIDER_MODE: 'stub',
    LLM_MODELS: JSON.stringify({ message_draft: 'test/strong' })
  });
  resetEnvCacheForTests();
});
afterAll(async () => {
  setLlmProvider(undefined);
  await stopJobs();
  await tdb?.drop();
});
beforeEach(async () => {
  fake = new FakeLlmProvider();
  fake.respond = () => 'Hi Pat, this is a draft.';
  setLlmProvider(fake);
  await tdb.admin`delete from llm_audit`;
  await tdb.admin`delete from llm_usage`;
});

describe('P5-7 prompts and outputs are logged, and customer-facing output waits for a person', () => {
  it('logs the prompt, output, subject and requester, and starts as pending', async () => {
    const r = await run();
    const [row] = await tdb.admin`select * from llm_audit where id = ${r.auditId}`;
    expect(row).toMatchObject({
      task: 'message_draft',
      subject_type: 'contact',
      subject_id: 'contact-1',
      requested_by: IDS.ownerA,
      data_handling: 'no_retention',
      output: 'Hi Pat, this is a draft.',
      approval_status: 'pending',
      approved_by: null
    });
    expect(JSON.stringify(row!.prompt)).toContain('Contact: Pat Example');
    expect(row!.usage_id).toBe(r.usageId);
  });

  it('a failed call still logs the prompt that was sent', async () => {
    const { ProviderError } = await import('@/server/adapters/errors');
    fake.failWith = new ProviderError('transient', 'network', 'down');
    await expect(run()).rejects.toThrow('down');
    const rows = await tdb.admin`select output, prompt from llm_audit`;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.output).toBeNull();
  });

  it('approval is stamped with the person and the audit log, and can happen once', async () => {
    const r = await run();
    expect(await decideLlmOutput(ownerA, r.auditId, 'approved', { db })).toBe(true);
    const [row] =
      await tdb.admin`select approval_status, approved_by, approved_at from llm_audit where id = ${r.auditId}`;
    expect(row).toMatchObject({ approval_status: 'approved', approved_by: IDS.ownerA });
    expect(row!.approved_at).not.toBeNull();
    const log =
      await tdb.admin`select actor_user_id, entity_id from audit_log where action = 'llm.approved'`;
    expect(log).toEqual([{ actor_user_id: IDS.ownerA, entity_id: r.auditId }]);
    expect(await decideLlmOutput(ownerA, r.auditId, 'rejected', { db })).toBe(false);
  });

  it('rejection is recorded, and the database refuses to reopen a decision', async () => {
    const r = await run();
    expect(await decideLlmOutput(ownerA, r.auditId, 'rejected', { db })).toBe(true);
    await expect(
      tdb.admin`update llm_audit set approval_status = 'approved' where id = ${r.auditId}`
    ).rejects.toThrow(/pending/);
  });

  it('output that needs no approval cannot be approved, and another client cannot decide', async () => {
    const plain = await run('not_required');
    expect(await decideLlmOutput(ownerA, plain.auditId, 'approved', { db })).toBe(false);
    const pending = await run();
    const ownerB = { tenantId: IDS.tenantB, userId: IDS.ownerB, role: 'owner' as const };
    expect(await decideLlmOutput(ownerB, pending.auditId, 'approved', { db })).toBe(false);
  });

  it('the runtime role cannot rewrite what was said or delete the record', async () => {
    const r = await run();
    await expect(
      tdb.app`update llm_audit set output = 'x' where id = ${r.auditId}`
    ).rejects.toThrow();
    await expect(tdb.app`delete from llm_audit`).rejects.toThrow();
  });
});
