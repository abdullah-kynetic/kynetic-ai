import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import {
  GET as brandingGet,
  PATCH as brandingPatch
} from '@/app/api/service/settings/branding/route';
import { GET as alexGet, PATCH as alexPatch } from '@/app/api/service/settings/alex/route';
import { GET as automationsGet } from '@/app/api/service/settings/automations/route';
import { PATCH as automationPatch } from '@/app/api/service/settings/automations/[key]/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// C13 settings, part 2b: branding (name and color, 3:1 contrast enforced), Alex (owner view, pause and
// call hours; alex:write), automations (list; enable and disable need automation:write, audited).

let tdb: TestDatabase;
let db: Db;
let keyN = 0;

const headers = (token?: string, key: string | null = `s2b-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}
type Ctx = { params: Promise<{ key: string }> };
const noParams: Ctx = { params: Promise.resolve({ key: '' }) };
const keyParams = (key: string): Ctx => ({ params: Promise.resolve({ key }) });

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  await tdb.admin`delete from tenant_modules where module_key = 'crm' and tenant_id = ${IDS.tenantA}`;
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${IDS.tenantA}, 'crm', true, 'full')`;
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

const call = (
  handler: (r: Request, c: Ctx) => Promise<Response>,
  method: string,
  path: string,
  body: unknown,
  t?: string,
  c: Ctx = noParams
) =>
  handler(
    new Request(`http://localhost${path}`, {
      method,
      headers: headers(t),
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    c
  );

describe('service API settings, part 2b (C13)', () => {
  it('gates branding on settings, Alex on alex:write, automation toggles on automation:write', async () => {
    const settingsOnly = await token(['settings:read', 'settings:write']);
    expect(
      (
        await call(
          brandingGet,
          'GET',
          '/api/service/settings/branding',
          undefined,
          settingsOnly.token
        )
      ).status
    ).toBe(200);
    expect(
      (
        await call(
          alexPatch,
          'PATCH',
          '/api/service/settings/alex',
          { paused: false },
          settingsOnly.token
        )
      ).status
    ).toBe(401);
    expect(
      (
        await call(
          automationPatch,
          'PATCH',
          '/api/service/settings/automations/speed_to_lead',
          { enabled: false },
          settingsOnly.token,
          keyParams('speed_to_lead')
        )
      ).status
    ).toBe(401);
    expect((await call(alexGet, 'GET', '/api/service/settings/alex', undefined)).status).toBe(401);
  });

  it('updates the brand name and color, and refuses a low-contrast color', async () => {
    const writer = await token(['settings:read', 'settings:write']);
    const ok = await call(
      brandingPatch,
      'PATCH',
      '/api/service/settings/branding',
      { name: 'Acme Roofing', primaryColor: '#8A6A2F' },
      writer.token
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.name).toBe('Acme Roofing');
    const low = await call(
      brandingPatch,
      'PATCH',
      '/api/service/settings/branding',
      { primaryColor: '#FFFF00' },
      writer.token
    );
    expect(low.status).toBe(400);
  });

  it('shows Alex without the raw prompt and changes only pause and call hours', async () => {
    const alex = await token(['settings:read', 'alex:write']);
    const view = await call(alexGet, 'GET', '/api/service/settings/alex', undefined, alex.token);
    expect(view.status).toBe(200);
    expect(JSON.stringify(await view.json())).not.toContain('prompt');

    const paused = await call(
      alexPatch,
      'PATCH',
      '/api/service/settings/alex',
      { paused: true },
      alex.token
    );
    expect(paused.status).toBe(200);
    expect((await paused.json()).data.paused).toBe(true);

    const greeting = await call(
      alexPatch,
      'PATCH',
      '/api/service/settings/alex',
      { greeting: 'Hi there' },
      alex.token
    );
    expect(greeting.status).toBe(400);
  });

  it('lists automations and turns one off with an audit row', async () => {
    const auto = await token(['settings:read', 'automation:write']);
    const list = await call(
      automationsGet,
      'GET',
      '/api/service/settings/automations',
      undefined,
      auto.token
    );
    expect(list.status).toBe(200);
    const keys = (await list.json()).data.map((r: { key: string }) => r.key);
    expect(keys).toContain('speed_to_lead');

    const off = await call(
      automationPatch,
      'PATCH',
      '/api/service/settings/automations/speed_to_lead',
      { enabled: false },
      auto.token,
      keyParams('speed_to_lead')
    );
    expect(off.status).toBe(200);
    const audited =
      await tdb.admin`select count(*)::int as n from audit_log where action = 'automation.toggle' and tenant_id = ${IDS.tenantA}`;
    expect(audited[0]!.n).toBeGreaterThan(0);
  });
});
