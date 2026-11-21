import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueServiceToken } from '@/server/service-auth';
import {
  GET as businessRoute,
  PATCH as businessPatch
} from '@/app/api/service/settings/business/route';
import { GET as hoursRoute, PATCH as hoursPatch } from '@/app/api/service/settings/hours/route';
import {
  GET as tagsRoute,
  POST as tagsPost,
  PATCH as tagsRename,
  DELETE as tagsDelete
} from '@/app/api/service/settings/tags/route';
import { GET as teamRoute } from '@/app/api/service/settings/team/route';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

// C13 settings, part 1: scopes, business profile and hours (with PATCH validation), tags (create,
// rename, delete) and the team list. Team invites and removals are held and not tested here.

let tdb: TestDatabase;
let db: Db;
let keyN = 0;

const headers = (token?: string, key: string | null = `set-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...(token ? { authorization: `Bearer ${token}` } : {}),
  ...(key ? { 'idempotency-key': key } : {})
});
async function token(scopes: string[]) {
  return issueServiceToken(ctx.ownerA(), { label: 'test', scopes }, { db });
}

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

const send = (
  route: (r: Request) => Promise<Response>,
  method: string,
  path: string,
  body: unknown,
  t?: string
) =>
  route(
    new Request(`http://localhost${path}`, {
      method,
      headers: headers(t),
      body: body === undefined ? undefined : JSON.stringify(body)
    })
  );

describe('service API settings, part 1 (C13)', () => {
  it('needs settings:read to read and settings:write to change', async () => {
    const reader = await token(['settings:read']);
    expect(
      (await send(businessRoute, 'GET', '/api/service/settings/business', undefined, reader.token))
        .status
    ).toBe(200);
    expect(
      (
        await send(
          businessPatch,
          'PATCH',
          '/api/service/settings/business',
          { timezone: 'America/Chicago' },
          reader.token
        )
      ).status
    ).toBe(401);
    expect(
      (await send(businessRoute, 'GET', '/api/service/settings/business', undefined)).status
    ).toBe(401);
  });

  it('updates the timezone, refuses plan or status fields, and audits the change', async () => {
    const writer = await token(['settings:read', 'settings:write']);
    const ok = await send(
      businessPatch,
      'PATCH',
      '/api/service/settings/business',
      { timezone: 'America/Denver' },
      writer.token
    );
    expect(ok.status).toBe(200);
    expect((await ok.json()).data.timezone).toBe('America/Denver');
    const refused = await send(
      businessPatch,
      'PATCH',
      '/api/service/settings/business',
      { status: 'active' },
      writer.token
    );
    expect(refused.status).toBe(400);
    const audited =
      await tdb.admin`select count(*)::int as n from audit_log where action = 'settings.business.update' and tenant_id = ${IDS.tenantA}`;
    expect(audited[0]!.n).toBeGreaterThan(0);
  });

  it('validates hours and returns them back', async () => {
    const writer = await token(['settings:read', 'settings:write']);
    const bad = await send(
      hoursPatch,
      'PATCH',
      '/api/service/settings/hours',
      { businessHours: { mon: [{ open: '17:00', close: '09:00' }] } },
      writer.token
    );
    expect(bad.status).toBe(400);
    const good = await send(
      hoursPatch,
      'PATCH',
      '/api/service/settings/hours',
      { businessHours: { mon: [{ open: '09:00', close: '17:00' }] } },
      writer.token
    );
    expect(good.status).toBe(200);
    const read = await (
      await send(hoursRoute, 'GET', '/api/service/settings/hours', undefined, writer.token)
    ).json();
    expect(read.data.businessHours.mon).toEqual([{ open: '09:00', close: '17:00' }]);
  });

  it('creates, renames and deletes a tag', async () => {
    const writer = await token(['settings:read', 'settings:write']);
    const created = await send(
      tagsPost,
      'POST',
      '/api/service/settings/tags',
      { name: 'partner' },
      writer.token
    );
    expect(created.status).toBe(201);
    expect((await created.json()).data.map((t: { name: string }) => t.name)).toContain('partner');
    const renamed = await send(
      tagsRename,
      'PATCH',
      '/api/service/settings/tags',
      { from: 'partner', to: 'gold' },
      writer.token
    );
    expect(renamed.status).toBe(200);
    const names = (await renamed.json()).data.map((t: { name: string }) => t.name);
    expect(names).toContain('gold');
    expect(names).not.toContain('partner');
    const deleted = await send(
      tagsDelete,
      'DELETE',
      '/api/service/settings/tags',
      { name: 'gold' },
      writer.token
    );
    expect(deleted.status).toBe(200);
    const listed = await (
      await send(tagsRoute, 'GET', '/api/service/settings/tags', undefined, writer.token)
    ).json();
    expect(listed.data.map((t: { name: string }) => t.name)).not.toContain('gold');
  });

  it('lists the team for an owner key', async () => {
    const reader = await token(['settings:read']);
    const res = await send(teamRoute, 'GET', '/api/service/settings/team', undefined, reader.token);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.members)).toBe(true);
  });
});
