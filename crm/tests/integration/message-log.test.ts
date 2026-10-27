import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '@/server/db/client';
import { applyEmailEvent } from '@/server/email';
import { listMessageLog } from '@/server/messaging';
import { ModuleDisabledError } from '@/server/modules';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let db: TestDatabase;
let opts: { db: ReturnType<typeof createDb> };
let a: SeededTenant;
let b: SeededTenant;

beforeAll(async () => {
  db = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(db.admin));
  opts = { db: createDb(db.app) };
  await db.admin`delete from messages`; // start from an empty log, not the fixture row
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = db.urls.app;
  process.env.DATABASE_URL_WORKER = db.urls.worker;
  process.env.DATABASE_URL_AUTH = db.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});
afterAll(async () => {
  await db?.drop();
});

const insert = (
  tenantId: string,
  contactId: string | null,
  o: {
    channel: 'sms' | 'email';
    direction?: 'inbound' | 'outbound';
    status: string;
    at: string;
    providerId?: string;
    error?: string;
  }
) =>
  db.admin`insert into messages (tenant_id, contact_id, channel, direction, actor_type, from_address,
    to_address, body, provider, provider_message_id, status, error_code, error_message, created_at)
    values (${tenantId}, ${contactId}, ${o.channel}, ${o.direction ?? 'outbound'}, 'automation',
    'from@example.test', 'to@example.test', 'Hello   there', ${o.providerId ? 'resend' : null},
    ${o.providerId ?? null}, ${o.status}, ${o.error ? '30034' : null}, ${o.error ?? null}, ${o.at})`;

describe('F-30 messages log', () => {
  it('lists SMS and email newest first with contact name and error text', async () => {
    await insert(IDS.tenantA, a.contactId, {
      channel: 'sms',
      status: 'delivered',
      at: '2026-10-01T10:00:00Z'
    });
    await insert(IDS.tenantA, a.contactId, {
      channel: 'sms',
      status: 'failed',
      at: '2026-10-02T10:00:00Z',
      error: 'Number not registered for A2P'
    });
    await insert(IDS.tenantA, null, {
      channel: 'email',
      direction: 'inbound',
      status: 'received',
      at: '2026-10-03T10:00:00Z'
    });
    const page = await listMessageLog(ctx.ownerA(), {}, opts);
    expect(page.rows.map((r) => r.status)).toEqual(['received', 'failed', 'delivered']);
    expect(page.rows[0]).toMatchObject({ contactName: null, preview: 'Hello there' });
    expect(page.rows[1]).toMatchObject({
      contactName: expect.any(String),
      errorSummary: '30034: Number not registered for A2P'
    });
    expect(page.rows[2]!.errorSummary).toBeNull();
  });

  it('never returns another tenant’s messages', async () => {
    await insert(IDS.tenantB, b.contactId, {
      channel: 'sms',
      status: 'sent',
      at: '2026-10-04T10:00:00Z'
    });
    const mine = await listMessageLog(ctx.ownerA(), {}, opts);
    expect(mine.rows).toHaveLength(3);
    const theirs = await listMessageLog(ctx.ownerB(), {}, opts);
    expect(theirs.rows).toHaveLength(1);
  });

  it('filters by channel and status', async () => {
    expect((await listMessageLog(ctx.ownerA(), { channel: 'email' }, opts)).rows).toHaveLength(1);
    const failed = await listMessageLog(ctx.ownerA(), { status: 'failed' }, opts);
    expect(failed.rows.map((r) => r.channel)).toEqual(['sms']);
  });

  it('pages with a cursor and no repeats or gaps', async () => {
    for (let i = 0; i < 55; i++) {
      await insert(IDS.tenantA, a.contactId, {
        channel: 'sms',
        status: 'sent',
        at: `2026-09-01T00:${String(i).padStart(2, '0')}:00Z`
      });
    }
    const first = await listMessageLog(ctx.ownerA(), {}, opts);
    expect(first.rows).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = await listMessageLog(ctx.ownerA(), { cursor: first.nextCursor! }, opts);
    expect(second.rows).toHaveLength(8);
    expect(second.nextCursor).toBeNull();
    const ids = [...first.rows, ...second.rows].map((r) => r.id);
    expect(new Set(ids).size).toBe(58);
  });

  it('shows a delivery callback on the next load', async () => {
    await insert(IDS.tenantA, a.contactId, {
      channel: 'email',
      status: 'sent',
      at: '2026-10-05T10:00:00Z',
      providerId: 'em_log1'
    });
    const workerDb = createDb(db.worker);
    await applyEmailEvent(
      { providerId: 'em_log1', kind: 'bounced', address: 'to@example.test' },
      { db: workerDb }
    );
    const [row] = (await listMessageLog(ctx.ownerA(), { status: 'bounced' }, opts)).rows;
    expect(row).toBeDefined();
  });

  it('refuses when no messaging module is on', async () => {
    await db.admin`update tenant_modules set enabled = false where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
    await expect(listMessageLog(ctx.ownerA(), {}, opts)).rejects.toBeInstanceOf(
      ModuleDisabledError
    );
    await db.admin`update tenant_modules set enabled = true where tenant_id = ${IDS.tenantA} and module_key = 'alex_core'`;
  });
});
