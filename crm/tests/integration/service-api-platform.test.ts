import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { issueServiceToken, ADMIN_CLIENT_HEADER } from '@/server/service-auth';
import {
  GET as clientsRoute,
  POST as onboardRoute
} from '@/app/api/service/platform/clients/route';
import { GET as clientRoute } from '@/app/api/service/platform/clients/[id]/route';
import { POST as goLiveRoute } from '@/app/api/service/platform/clients/[id]/go-live/route';
import { GET as templatesRoute } from '@/app/api/service/platform/templates/route';
import { ctx, IDS } from '../helpers/fixtures';
import { setupAgency } from '../helpers/agency';

// E1: platform controls. Owner's admin key only, no client header. A client token is refused, and a
// request that names a client is refused with 400 so it cannot look scoped to one client.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let adminKey: string;
let keyN = 0;
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';
const NIL = '00000000-0000-4000-8000-000000000000';

const bearer = () => ({ authorization: `Bearer ${adminKey}` });
const jsonHeaders = (extra: Record<string, string> = {}) => ({
  'content-type': 'application/json',
  ...extra
});
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  setup = await setupAgency();
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = setup.db;
  adminKey = (
    await issueAdminKey(owner, { label: 'e1', allowedCidrs: [] }, { db: setup.db, ownerEmail })
  ).key;
  void keyN;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

describe('service API platform controls (E1)', () => {
  it('refuses a client token', async () => {
    const client = await issueServiceToken(
      ctx.ownerA(),
      { label: 'c-e1', scopes: ['tenant:read'] },
      { db: setup.db }
    );
    const res = await clientsRoute(
      new Request('http://localhost/api/service/platform/clients', {
        headers: { authorization: `Bearer ${client.token}` }
      })
    );
    expect(res.status).toBe(401);
  });

  it('refuses a request that names a client', async () => {
    const res = await clientsRoute(
      new Request('http://localhost/api/service/platform/clients', {
        headers: { ...bearer(), [ADMIN_CLIENT_HEADER]: 'some-client' }
      })
    );
    expect(res.status).toBe(400);
  });

  it('lists clients and reads templates with the owner key', async () => {
    const list = await clientsRoute(
      new Request('http://localhost/api/service/platform/clients', { headers: bearer() })
    );
    expect(list.status).toBe(200);
    const body = await list.json();
    expect(Array.isArray(body.data)).toBe(true);
    const templates = await templatesRoute(
      new Request('http://localhost/api/service/platform/templates', { headers: bearer() })
    );
    expect(templates.status).toBe(200);
  });

  it('returns not found for an unknown client', async () => {
    const res = await clientRoute(
      new Request(`http://localhost/api/service/platform/clients/${NIL}`, { headers: bearer() }),
      ctxId(NIL)
    );
    expect(res.status).toBe(404);
  });

  it('onboards a client with defaults, and refuses go-live while the checklist is open', async () => {
    const created = await onboardRoute(
      new Request('http://localhost/api/service/platform/clients', {
        method: 'POST',
        headers: jsonHeaders(bearer()),
        body: JSON.stringify({
          businessName: 'E1 Test Co',
          ownerEmail: 'owner-e1@example.test',
          phone: '+12025550100',
          industry: 'roofing',
          timezone: 'America/Chicago',
          hours: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], open: '08:00', close: '17:00' },
          plan: 'value',
          modules: []
        })
      })
    );
    expect(created.status).toBe(201);
    const id = (await created.json()).data.tenantId as string;
    const live = await goLiveRoute(
      new Request(`http://localhost/api/service/platform/clients/${id}/go-live`, {
        method: 'POST',
        headers: bearer()
      }),
      ctxId(id)
    );
    expect(live.status).toBeGreaterThanOrEqual(400);
  });
});
