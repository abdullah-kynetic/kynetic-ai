import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import {
  clearSubscribers,
  deliver,
  emitEvent,
  registerEventWorkers,
  subscribe,
  type EventEnvelope
} from '@/server/events';
import { enqueue, registerWorker, stopJobs } from '@/server/jobs';
import {
  clearWebhookProcessors,
  ingestWebhook,
  processWebhookEvent,
  registerWebhookProcessor,
  registerWebhookWorker,
  WebhookSignatureError
} from '@/server/webhooks';
import { IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let appDb: ReturnType<typeof createDb>;
let workerDb: ReturnType<typeof createDb>;

beforeAll(async () => {
  db = await createTestDatabase({
    jobs: true,
    jobQueues: {
      'test.retry': { retryLimit: 3, retryDelay: 1, retryBackoff: true },
      'test.tx': {}
    }
  });
  await seedTwoTenants(db.admin);
  appDb = createDb(db.app);
  workerDb = createDb(db.worker);
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = db.urls.app;
  process.env.DATABASE_URL_WORKER = db.urls.worker;
  process.env.DATABASE_URL_AUTH = db.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});
afterAll(async () => {
  await stopJobs();
  await db?.drop();
});

async function until(check: () => Promise<boolean> | boolean, ms = 20_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('timed out waiting for condition');
}

describe('M0-15 jobs facade', () => {
  it('a failing job retries with backoff and then succeeds', async () => {
    const attempts: number[] = [];
    await registerWorker<{ n: number }>(
      'test.retry',
      async (_data, job) => {
        attempts.push(Date.now());
        if (job.retryCount < 2) throw new Error('boom');
      },
      { pollingIntervalSeconds: 0.5 }
    );
    await enqueue('test.retry', { n: 1 });
    await until(() => attempts.length >= 3);
    expect(attempts).toHaveLength(3);
    // backoff: the gap before the third attempt is longer than the gap before the second
    expect(attempts[2] - attempts[1]).toBeGreaterThan(attempts[1] - attempts[0] - 200);
  }, 30_000);

  it('a job queued in a transaction is not delivered if the transaction rolls back', async () => {
    const seen: number[] = [];
    await registerWorker<{ n: number }>('test.tx', async (d) => void seen.push(d.n), {
      pollingIntervalSeconds: 0.5
    });
    await expect(
      appDb.transaction(async (tx) => {
        await enqueue('test.tx', { n: 1 }, { tx });
        throw new Error('rollback');
      })
    ).rejects.toThrow('rollback');
    await appDb.transaction(async (tx) => {
      await enqueue('test.tx', { n: 2 }, { tx });
    });
    await until(() => seen.includes(2));
    expect(seen).toEqual([2]);
  }, 30_000);
});

describe('M0-15 job queue privileges', () => {
  it('the runtime roles can use the queue schema but not change it', async () => {
    await expect(db.app`create table pgboss.rogue (id int)`).rejects.toThrow(/permission denied/);
    await expect(db.worker`drop table pgboss.job`).rejects.toThrow(
      /must be owner|permission denied/
    );
  });
});

describe('M0-15 events', () => {
  it('delivers an emitted event to each subscriber once, in order of registration', async () => {
    clearSubscribers();
    const got: string[] = [];
    subscribe('lead.created', 'sub-a', async (e) => void got.push(`a:${e.payload.leadId}`));
    subscribe('lead.created', 'sub-b', async (e) => void got.push(`b:${e.payload.leadId}`));
    await registerEventWorkers({ pollingIntervalSeconds: 0.5 });
    const env = await appDb.transaction((tx) =>
      emitEvent(tx, {
        name: 'lead.created',
        tenantId: IDS.tenantA,
        actor: { type: 'system' },
        payload: { leadId: 'L1' }
      })
    );
    expect(env.version).toBe(1);
    await until(() => got.length >= 2);
    expect(got.sort()).toEqual(['a:L1', 'b:L1']);
  }, 30_000);

  it('an event emitted in a rolled-back transaction is never delivered', async () => {
    const got: string[] = [];
    subscribe('lead.rolled_back', 'sub-rb', async (e) => void got.push(String(e.payload.leadId)));
    await expect(
      appDb.transaction(async (tx) => {
        await emitEvent(tx, {
          name: 'lead.rolled_back',
          tenantId: IDS.tenantA,
          actor: { type: 'system' },
          payload: { leadId: 'gone' }
        });
        throw new Error('rollback');
      })
    ).rejects.toThrow();
    await appDb.transaction((tx) =>
      emitEvent(tx, {
        name: 'lead.rolled_back',
        tenantId: IDS.tenantA,
        actor: { type: 'system' },
        payload: { leadId: 'kept' }
      })
    );
    await until(() => got.includes('kept'));
    expect(got).toEqual(['kept']);
  }, 30_000);

  it('skips a subscriber whose module is off for the tenant and runs it once on', async () => {
    const got: string[] = [];
    subscribe('x.happened', 'mod-sub', async (e) => void got.push(e.id), {
      module: 'reactivation'
    });
    const env = {
      id: crypto.randomUUID(),
      name: 'x.happened',
      version: 1,
      tenantId: IDS.tenantA,
      occurredAt: new Date().toISOString(),
      actor: { type: 'system' },
      payload: {}
    } as EventEnvelope;
    process.env.DATABASE_URL = db.urls.app;
    expect(await deliver(env, 'mod-sub')).toBe('skipped');
    await db.admin`insert into tenant_modules (tenant_id, module_key, enabled) values (${IDS.tenantA}, 'reactivation', true)`;
    expect(await deliver(env, 'mod-sub')).toBe('ran');
    expect(got).toEqual([env.id]);
  });

  it('rejects a malformed envelope', async () => {
    await expect(
      appDb.transaction((tx) =>
        emitEvent(tx, { name: '', tenantId: 'nope', actor: { type: 'system' }, payload: {} })
      )
    ).rejects.toThrow();
  });
});

describe('M0-15 webhook ingest (F-77)', () => {
  const body = { id: 'evt_1', value: 42 };

  it('the same external id replayed 10 times has one effect', async () => {
    clearWebhookProcessors();
    const processed: string[] = [];
    registerWebhookProcessor('twilio', async (e) => void processed.push(e.externalId));
    await registerWebhookWorker({ pollingIntervalSeconds: 0.5 });
    const results = [];
    for (let i = 0; i < 10; i++) {
      results.push(
        await ingestWebhook(
          {
            source: 'twilio',
            externalId: 'SM1',
            tenantId: IDS.tenantA,
            payload: body,
            verify: () => true
          },
          { db: appDb }
        )
      );
    }
    expect(results.filter((r) => r.status === 'accepted')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'duplicate')).toHaveLength(9);
    await until(() => processed.length >= 1);
    await new Promise((r) => setTimeout(r, 1500));
    expect(processed).toEqual(['SM1']);
    const [{ n }] =
      await db.admin`select count(*)::int as n from webhook_events where source = 'twilio' and external_id = 'SM1'`;
    expect(n).toBe(1);
    const [row] =
      await db.admin`select processed_at, attempts from webhook_events where external_id = 'SM1'`;
    expect(row.processed_at).not.toBeNull();
  }, 30_000);

  it('the same external id from a different source is a different event', async () => {
    const r = await ingestWebhook(
      { source: 'resend', externalId: 'SM1', payload: body, verify: () => true },
      { db: appDb }
    );
    expect(r.status).toBe('accepted');
  });

  it('a bad signature stores nothing and queues nothing', async () => {
    await expect(
      ingestWebhook(
        { source: 'twilio', externalId: 'SM-bad', payload: body, verify: () => false },
        { db: appDb }
      )
    ).rejects.toBeInstanceOf(WebhookSignatureError);
    const [{ n }] =
      await db.admin`select count(*)::int as n from webhook_events where external_id = 'SM-bad'`;
    expect(n).toBe(0);
  });

  it('a failing processor records attempts and the error, then a retry succeeds without double effect', async () => {
    clearWebhookProcessors();
    let calls = 0;
    registerWebhookProcessor('flaky', async () => {
      calls += 1;
      if (calls === 1) throw new Error('provider down');
    });
    const r = await ingestWebhook(
      { source: 'flaky', externalId: 'F1', payload: body, verify: () => true },
      { db: appDb }
    );
    await expect(processWebhookEvent(r.id!, { db: workerDb })).rejects.toThrow('provider down');
    const [failed] =
      await db.admin`select attempts, last_error, processed_at from webhook_events where id = ${r.id!}`;
    expect(failed).toMatchObject({ attempts: 1, last_error: 'provider down', processed_at: null });
    expect(await processWebhookEvent(r.id!, { db: workerDb })).toBe('processed');
    expect(await processWebhookEvent(r.id!, { db: workerDb })).toBe('already_processed');
    expect(calls).toBe(2);
  });

  it('the app role can insert webhook events but cannot read them back', async () => {
    await expect(db.app`select id from webhook_events limit 1`).rejects.toThrow(
      /permission denied/
    );
  });
});
