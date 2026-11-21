import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { GET as listRoute } from '@/app/api/service/conversations/route';
import { GET as threadRoute } from '@/app/api/service/conversations/[id]/messages/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;
let noConsent: string;

async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}

const list = (t?: string) =>
  listRoute(
    new Request('http://localhost/api/service/conversations', {
      headers: t ? { authorization: `Bearer ${t}` } : {}
    })
  );
const thread = (id: string, t?: string) =>
  threadRoute(
    new Request(`http://localhost/api/service/conversations/${id}/messages`, {
      headers: t ? { authorization: `Bearer ${t}` } : {}
    }),
    { params: Promise.resolve({ id }) }
  );

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full')`;
  const [c] =
    await tdb.admin`insert into contacts (tenant_id, first_name, primary_phone_e164, timezone)
    values (${IDS.tenantA}, 'NoConsent', '+12025550777', 'America/Los_Angeles') returning id`;
  noConsent = c!.id;
  for (const [tenant, contact, body] of [
    [IDS.tenantA, a.contactId, 'A hello'],
    [IDS.tenantA, noConsent, 'A text'],
    [IDS.tenantB, b.contactId, 'B secret']
  ] as const) {
    await tdb.admin`insert into messages (tenant_id, contact_id, channel, direction, actor_type, from_address, to_address, body, status)
      values (${tenant}, ${contact}, 'sms', 'outbound', 'user', 'fixture', 'fixture', ${body}, 'delivered')`;
  }
  db = createDb(tdb.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'integration-only-secret-not-real-000000000000',
    APP_ENCRYPTION_KEY: 'integration-only-encryption-key-not-real'
  });
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await tdb?.drop();
});

describe('messages: auth and scope', () => {
  it('401 without messages:read; another scope is refused', async () => {
    expect((await list()).status).toBe(401);
    const wrong = await token(['contacts:read']);
    expect((await list(wrong.token)).status).toBe(401);
  });
});

describe('messages: conversations and threads', () => {
  it("lists only this tenant's conversations", async () => {
    const t = await token(['messages:read']);
    const res = await list(t.token);
    expect(res.status).toBe(200);
    const ids = (await res.json()).data.map((c: { id: string }) => c.id);
    expect(ids).toContain(a.contactId);
    expect(ids).not.toContain(b.contactId);
  });

  it('a thread shows each channel with canSend and, when blocked, the reason in plain words', async () => {
    const t = await token(['messages:read']);
    const res = await thread(noConsent, t.token);
    expect(res.status).toBe(200);
    const data = (await res.json()).data;
    expect(data.messages[0].body).toBe('A text');
    const sms = data.channels.find((c: { channel: string }) => c.channel === 'sms');
    expect(sms.canSend).toBe(false);
    expect(sms.message).toMatch(/consent|not agreed|not approved|switched off/i);
  });

  it("another tenant's thread is a 404", async () => {
    const t = await token(['messages:read']);
    expect((await thread(b.contactId, t.token)).status).toBe(404);
  });
});
