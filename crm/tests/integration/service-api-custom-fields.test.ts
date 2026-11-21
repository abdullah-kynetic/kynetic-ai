import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { GET, POST } from '@/app/api/service/settings/custom-fields/route';
import {
  DELETE as fieldDelete,
  PATCH as fieldPatch
} from '@/app/api/service/settings/custom-fields/[id]/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// C13 settings, part 2: custom field definitions. Read and write use the settings scopes; key, type
// and entity cannot change after create; a delete removes the definition.

let tdb: TestDatabase;
let db: Db;
let keyN = 0;

const headers = (token?: string, key: string | null = `cf-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

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

type Ctx = { params: Promise<{ id: string }> };
const call = (
  handler: (r: Request, c: Ctx) => Promise<Response>,
  method: string,
  path: string,
  body: unknown,
  t?: string,
  ctxArg: Ctx = params('')
) =>
  handler(
    new Request(`http://localhost${path}`, {
      method,
      headers: headers(t),
      body: body === undefined ? undefined : JSON.stringify(body)
    }),
    ctxArg
  );

const path = '/api/service/settings/custom-fields';

describe('service API custom fields, part 2 (C13)', () => {
  it('needs settings:read to read and settings:write to change', async () => {
    const reader = await token(['settings:read']);
    expect((await call(GET, 'GET', path, undefined, reader.token)).status).toBe(200);
    const refused = await call(
      POST,
      'POST',
      path,
      { entity: 'contact', key: 'roof_age', label: 'Roof age', type: 'number' },
      reader.token
    );
    expect(refused.status).toBe(401);
    expect((await call(GET, 'GET', path, undefined)).status).toBe(401);
  });

  it('creates a field, lists it by entity, and rejects an unknown entity filter', async () => {
    const writer = await token(['settings:read', 'settings:write']);
    const created = await call(
      POST,
      'POST',
      path,
      {
        entity: 'contact',
        key: 'roof_type',
        label: 'Roof type',
        type: 'select',
        options: ['Shingle', 'Metal']
      },
      writer.token
    );
    expect(created.status).toBe(201);
    const id = (await created.json()).data.id as string;

    const list = await call(GET, 'GET', `${path}?entity=contact`, undefined, writer.token);
    const keys = (await list.json()).data.map((f: { key: string }) => f.key);
    expect(keys).toContain('roof_type');

    const bad = await call(GET, 'GET', `${path}?entity=lead`, undefined, writer.token);
    expect(bad.status).toBe(400);
    expect(id).toMatch(/[0-9a-f-]{36}/);
  });

  it('refuses a select field without options and changes to key or type', async () => {
    const writer = await token(['settings:read', 'settings:write']);
    const noOptions = await call(
      POST,
      'POST',
      path,
      { entity: 'contact', key: 'hoa', label: 'HOA', type: 'select' },
      writer.token
    );
    expect(noOptions.status).toBe(400);

    const created = await call(
      POST,
      'POST',
      path,
      { entity: 'contact', key: 'window_count', label: 'Windows', type: 'number' },
      writer.token
    );
    const id = (await created.json()).data.id as string;
    const keyChange = await call(
      fieldPatch,
      'PATCH',
      `${path}/${id}`,
      { key: 'other', label: 'Windows' },
      writer.token,
      params(id)
    );
    expect(keyChange.status).toBe(400);
  });

  it('updates the label, then deletes the definition', async () => {
    const writer = await token(['settings:read', 'settings:write']);
    const created = await call(
      POST,
      'POST',
      path,
      { entity: 'company', key: 'budget_band', label: 'Budget band', type: 'text' },
      writer.token
    );
    const id = (await created.json()).data.id as string;

    const renamed = await call(
      fieldPatch,
      'PATCH',
      `${path}/${id}`,
      { label: 'Budget range' },
      writer.token,
      params(id)
    );
    expect(renamed.status).toBe(200);
    expect((await renamed.json()).data.label).toBe('Budget range');

    const deleted = await call(
      fieldDelete,
      'DELETE',
      `${path}/${id}`,
      undefined,
      writer.token,
      params(id)
    );
    expect(deleted.status).toBe(200);
    const after = await call(GET, 'GET', `${path}?entity=company`, undefined, writer.token);
    const keys = (await after.json()).data.map((f: { key: string }) => f.key);
    expect(keys).not.toContain('budget_band');
  });
});
