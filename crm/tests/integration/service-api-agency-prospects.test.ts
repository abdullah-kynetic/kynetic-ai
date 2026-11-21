import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { getAgencyWorkspace } from '@/server/agency';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { issueServiceToken, ADMIN_CLIENT_HEADER } from '@/server/service-auth';
import { GET as listRoute, POST as createRoute } from '@/app/api/service/agency/prospects/route';
import { GET as funnelRoute } from '@/app/api/service/agency/prospects/funnel/route';
import { POST as moveRoute } from '@/app/api/service/agency/prospects/move-to-sales/route';
import { ctx, IDS } from '../helpers/fixtures';
import { setupAgency, agencyAdmin } from '../helpers/agency';

// D1: agency prospects through the owner's admin key. Client tokens get 403. A key that names a client
// other than the agency gets 403. A prospect on the do-not-call list is not moved to Sales.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let db: Db;
let adminKey: string;
let agencySlug = '';
let clientSlug = '';
let keyN = 0;
const ownerEmail = 'admin@example.test';
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };

const headers = (
  extra: Record<string, string>,
  key: string | null = `ap-${Date.now()}-${keyN++}`
) => ({
  'content-type': 'application/json',
  ...extra,
  ...(key ? { 'idempotency-key': key } : {})
});
const adminHeaders = (slug = agencySlug): Record<string, string> => ({
  authorization: `Bearer ${adminKey}`,
  [ADMIN_CLIENT_HEADER]: slug
});
const bearer = (t: string): Record<string, string> => ({ authorization: `Bearer ${t}` });
const noCtx = { params: Promise.resolve({}) };

beforeAll(async () => {
  setup = await setupAgency();
  db = setup.db;
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  const ws = (await getAgencyWorkspace(agencyAdmin, true, { db }))!;
  agencySlug = ws.slug;
  clientSlug = (await setup.test.admin`select slug from tenants where id = ${IDS.tenantA}`)[0]!
    .slug;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  adminKey = (await issueAdminKey(owner, { label: 'agency', allowedCidrs: [] }, { db, ownerEmail }))
    .key;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

const req = (url: string, method: string, h: Record<string, string>, body?: unknown) =>
  new Request(`http://localhost${url}`, {
    method,
    headers: headers(h, method === 'GET' ? null : undefined),
    body: body === undefined ? undefined : JSON.stringify(body)
  });

describe('service API agency prospects (D1)', () => {
  it('refuses a client token with 403, even with the scope ticked', async () => {
    const client = await issueServiceToken(
      ctx.ownerA(),
      { label: 'client', scopes: ['contacts:read', 'contacts:write'] },
      { db }
    );
    const res = await listRoute(req('/api/service/agency/prospects', 'GET', bearer(client.token)));
    expect(res.status).toBe(403);
  });

  it('refuses an admin key that names a client workspace instead of the agency', async () => {
    const res = await listRoute(
      req('/api/service/agency/prospects', 'GET', adminHeaders(clientSlug))
    );
    expect(res.status).toBe(403);
  });

  it('creates a prospect and shows it in the funnel and the list', async () => {
    const created = await createRoute(
      req('/api/service/agency/prospects', 'POST', adminHeaders(), {
        source: 'google_maps',
        businessName: 'Lone Star Roofing',
        email: 'owner@example.test',
        phone: '+12025550100',
        state: 'TX'
      })
    );
    expect(created.status).toBe(201);
    const funnel = await funnelRoute(
      req('/api/service/agency/prospects/funnel', 'GET', adminHeaders()),
      noCtx
    );
    expect((await funnel.json()).data.total).toBeGreaterThan(0);
    const list = await listRoute(
      req('/api/service/agency/prospects?state=TX', 'GET', adminHeaders())
    );
    expect((await list.json()).data.length).toBeGreaterThan(0);
  });

  it('refuses a Florida prospect', async () => {
    const res = await createRoute(
      req('/api/service/agency/prospects', 'POST', adminHeaders(), {
        source: 'google_maps',
        businessName: 'Gulf Coast Roofing',
        state: 'FL'
      })
    );
    expect(res.status).toBe(400);
  });

  it('skips a do-not-call prospect when moving to Sales and moves the others', async () => {
    const dncP = await createRoute(
      req('/api/service/agency/prospects', 'POST', adminHeaders(), {
        source: 'manual',
        businessName: 'Blocked Co',
        email: 'blocked@example.test',
        phone: '+12025550101'
      })
    );
    const dncId = (await dncP.json()).data.id as string;
    const okP = await createRoute(
      req('/api/service/agency/prospects', 'POST', adminHeaders(), {
        source: 'manual',
        businessName: 'Clear Co',
        email: 'clear@example.test',
        phone: '+12025550102'
      })
    );
    const okId = (await okP.json()).data.id as string;
    await setup.test
      .admin`insert into dnc_entries (tenant_id, e164, source) values (${setup.tenantId}, '+12025550101', 'test')`;

    const res = await moveRoute(
      req('/api/service/agency/prospects/move-to-sales', 'POST', adminHeaders(), {
        ids: [dncId, okId]
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()).data;
    expect(body.moved.map((m: { prospectId: string }) => m.prospectId)).toEqual([okId]);
    expect(body.skipped).toContainEqual(
      expect.objectContaining({ prospectId: dncId, reason: 'On the do-not-call list.' })
    );
  });

  it('refuses a move with no ids', async () => {
    const res = await moveRoute(
      req('/api/service/agency/prospects/move-to-sales', 'POST', adminHeaders(), { ids: [] })
    );
    expect(res.status).toBe(400);
  });
});
