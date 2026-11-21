import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import { POST as createRoute } from '@/app/api/service/deals/route';
import { DELETE as deleteRoute, PATCH as patchRoute } from '@/app/api/service/deals/[id]/route';
import { POST as restoreRoute } from '@/app/api/service/deals/[id]/restore/route';
import {
  POST as stageCreate,
  GET as stageList
} from '@/app/api/service/pipelines/[id]/stages/route';
import { PUT as reorderRoute } from '@/app/api/service/pipelines/[id]/stages/order/route';
import { PATCH as stagePatch, DELETE as stageDelete } from '@/app/api/service/stages/[id]/route';
import { ctx, IDS, seedTwoTenants, type SeededTenant } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let a: SeededTenant;
let b: SeededTenant;
let keyN = 0;
let pipelineA: string;
let stageA: string;
let stageAOther: string;
let stageB: string;

const headers = (token?: string, key: string | null = `key-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
const body = (v: unknown) => (typeof v === 'string' ? v : JSON.stringify(v));
async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}
const withId = (id: string) => ({ params: Promise.resolve({ id }) });

const counts = async () => {
  const [r] = await tdb.admin`select
    (select count(*) from deals)::int as deals,
    (select count(*) from deals where deleted_at is null)::int as live,
    (select count(*) from pipeline_stages)::int as stages`;
  return r!;
};

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level)
    values (${IDS.tenantA}, 'crm', true, 'full')`;
  const [p] = await tdb.admin`insert into pipelines (tenant_id, name, is_default)
    values (${IDS.tenantA}, 'Sales', false) returning id`;
  pipelineA = p!.id;
  const [s1] = await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
    values (${IDS.tenantA}, ${pipelineA}, 'New', 0) returning id`;
  const [s2] = await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
    values (${IDS.tenantA}, ${pipelineA}, 'Quote', 1) returning id`;
  stageA = s1!.id;
  stageAOther = s2!.id;
  const [pb] = await tdb.admin`insert into pipelines (tenant_id, name, is_default)
    values (${IDS.tenantB}, 'B Sales', false) returning id`;
  const [sb] = await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
    values (${IDS.tenantB}, ${pb!.id}, 'B New', 0) returning id`;
  stageB = sb!.id;
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

describe('deals: create, edit, delete, restore', () => {
  it('create, edit, delete and restore one deal', async () => {
    const t = await token(['deals:write']);
    const made = await createRoute(
      new Request('http://localhost/api/service/deals', {
        method: 'POST',
        headers: headers(t.token),
        body: body({ title: 'Roof job', stageId: stageA, pipelineId: pipelineA })
      })
    );
    expect(made.status).toBe(201);
    const id = (await made.json()).data.id as string;
    const edited = await patchRoute(
      new Request(`http://localhost/api/service/deals/${id}`, {
        method: 'PATCH',
        headers: headers(t.token),
        body: body({ title: 'Roof job, north side' })
      }),
      withId(id)
    );
    expect(edited.status).toBe(200);
    expect((await edited.json()).data.title).toBe('Roof job, north side');
    const gone = await deleteRoute(
      new Request(`http://localhost/api/service/deals/${id}`, {
        method: 'DELETE',
        headers: headers(t.token)
      }),
      withId(id)
    );
    expect(gone.status).toBe(200);
    const back = await restoreRoute(
      new Request(`http://localhost/api/service/deals/${id}/restore`, {
        method: 'POST',
        headers: headers(t.token),
        body: ''
      }),
      withId(id)
    );
    expect(back.status).toBe(200);
  });

  it("another tenant's deal is a 404 and nothing changes", async () => {
    const t = await token(['deals:write']);
    const [other] =
      await tdb.admin`insert into deals (tenant_id, title, stage_id, pipeline_id, position)
      select ${IDS.tenantB}, 'B deal', ${stageB}, pipeline_id, 'a0' from pipeline_stages where id = ${stageB} returning id`;
    const c = await counts();
    const res = await patchRoute(
      new Request(`http://localhost/api/service/deals/${other!.id}`, {
        method: 'PATCH',
        headers: headers(t.token),
        body: body({ title: 'Hacked' })
      }),
      withId(other!.id)
    );
    expect(res.status).toBe(404);
    expect(await counts()).toEqual(c);
  });
});

describe('pipeline stages', () => {
  it('needs pipeline:write to change stages; deals:read can only list them', async () => {
    const readOnly = await token(['deals:read']);
    const list = await stageList(
      new Request(`http://localhost/api/service/pipelines/${pipelineA}/stages`, {
        headers: headers(readOnly.token, null)
      }),
      withId(pipelineA)
    );
    expect(list.status).toBe(200);
    const add = await stageCreate(
      new Request(`http://localhost/api/service/pipelines/${pipelineA}/stages`, {
        method: 'POST',
        headers: headers(readOnly.token),
        body: body({ name: 'Nope' })
      }),
      withId(pipelineA)
    );
    expect(add.status).toBe(401);
  });

  it('reorder is atomic: one unknown stage id changes nothing', async () => {
    const t = await token(['pipeline:write']);
    const before =
      await tdb.admin`select id, position from pipeline_stages where pipeline_id = ${pipelineA} order by position`;
    const bad = await reorderRoute(
      new Request(`http://localhost/api/service/pipelines/${pipelineA}/stages/order`, {
        method: 'PUT',
        headers: headers(t.token),
        body: body({ stageIds: [stageAOther, crypto.randomUUID()] })
      }),
      withId(pipelineA)
    );
    expect(bad.status).toBeGreaterThanOrEqual(400);
    const after =
      await tdb.admin`select id, position from pipeline_stages where pipeline_id = ${pipelineA} order by position`;
    expect(after).toEqual(before);
  });

  it("another tenant's stage is a 404 for edit and delete", async () => {
    const t = await token(['pipeline:write']);
    const edit = await stagePatch(
      new Request(`http://localhost/api/service/stages/${stageB}`, {
        method: 'PATCH',
        headers: headers(t.token),
        body: body({ name: 'Hacked' })
      }),
      withId(stageB)
    );
    expect(edit.status).toBe(404);
    const del = await stageDelete(
      new Request(`http://localhost/api/service/stages/${stageB}`, {
        method: 'DELETE',
        headers: headers(t.token)
      }),
      withId(stageB)
    );
    expect(del.status).toBe(404);
  });
});
