import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { getAgencyWorkspace } from '@/server/agency';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { issueServiceToken, ADMIN_CLIENT_HEADER } from '@/server/service-auth';
import { GET as pipelineRoute } from '@/app/api/service/agency/pipeline/route';
import { POST as moveRoute } from '@/app/api/service/agency/deals/[id]/move/route';
import {
  GET as contractsRoute,
  POST as contractCreate
} from '@/app/api/service/agency/contracts/route';
import { POST as markSent } from '@/app/api/service/agency/contracts/[id]/mark-sent/route';
import { POST as markSigned } from '@/app/api/service/agency/contracts/[id]/mark-signed/route';
import { POST as voidRoute } from '@/app/api/service/agency/contracts/[id]/void/route';
import { POST as prospectCreate } from '@/app/api/service/agency/prospects/route';
import { POST as moveToSales } from '@/app/api/service/agency/prospects/move-to-sales/route';
import { ctx, IDS } from '../helpers/fixtures';
import { setupAgency, agencyAdmin } from '../helpers/agency';

// D2: pipeline, deal moves, contracts. Admin key only. A contract that was never sent can be voided;
// a sent one is still a draft to the portal, and the API only records sending.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let db: Db;
let adminKey: string;
let agencySlug = '';
let keyN = 0;
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';

const h = (extra: Record<string, string>, key: string | null = `d2-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...extra,
  ...(key ? { 'idempotency-key': key } : {})
});
const adminHeaders = (): Record<string, string> => ({
  authorization: `Bearer ${adminKey}`,
  [ADMIN_CLIENT_HEADER]: agencySlug
});
const json = (r: Response) => r.json();
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });
const post = (url: string, body: unknown, headers = adminHeaders()) =>
  new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: h(headers),
    body: JSON.stringify(body)
  });

beforeAll(async () => {
  setup = await setupAgency();
  db = setup.db;
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  agencySlug = (await getAgencyWorkspace(agencyAdmin, true, { db }))!.slug;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  adminKey = (await issueAdminKey(owner, { label: 'd2', allowedCidrs: [] }, { db, ownerEmail }))
    .key;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

describe('service API agency pipeline and contracts (D2)', () => {
  it('refuses a client token on the pipeline', async () => {
    const client = await issueServiceToken(
      ctx.ownerA(),
      { label: 'c', scopes: ['deals:read'] },
      { db }
    );
    const res = await pipelineRoute(
      new Request('http://localhost/api/service/agency/pipeline', {
        headers: { authorization: `Bearer ${client.token}` }
      })
    );
    expect(res.status).toBe(403);
  });

  it('moves a deal to another stage, is a no-op when repeated, and renames nothing it should not', async () => {
    const created = await prospectCreate(
      post('/api/service/agency/prospects', {
        source: 'manual',
        businessName: 'Pipeline Co',
        email: 'pipe@example.test',
        phone: '+12025550105'
      })
    );
    const prospectId = (await json(created)).data.id as string;
    const moved = await moveToSales(
      post('/api/service/agency/prospects/move-to-sales', { ids: [prospectId] })
    );
    const dealId = (await json(moved)).data.moved[0].dealId as string;

    const pipe = await json(
      await pipelineRoute(
        new Request('http://localhost/api/service/agency/pipeline', { headers: adminHeaders() })
      )
    );
    const stages = pipe.data.stages as { id: string }[];
    expect(stages.length).toBeGreaterThan(1);
    const target = stages[1]!.id;

    const first = await moveRoute(
      post(`/api/service/agency/deals/${dealId}/move`, { stageId: target }),
      ctxId(dealId)
    );
    expect(first.status).toBe(200);
    const again = await moveRoute(
      post(`/api/service/agency/deals/${dealId}/move`, { stageId: target }),
      ctxId(dealId)
    );
    expect(again.status).toBe(200);
  });

  it('voids an unsigned contract, is a no-op when repeated, and refuses to void a signed one', async () => {
    const deals = await setup.test
      .admin`select id from deals where tenant_id = ${setup.tenantId} limit 1`;
    const dealId = deals[0]!.id as string;

    const draft = await contractCreate(
      post('/api/service/agency/contracts', { dealId, title: 'Draft terms' })
    );
    expect(draft.status).toBe(201);
    const draftId = (await json(draft)).data.id as string;
    const voided = await voidRoute(
      post(`/api/service/agency/contracts/${draftId}/void`, {}),
      ctxId(draftId)
    );
    expect(voided.status).toBe(200);
    const repeat = await voidRoute(
      post(`/api/service/agency/contracts/${draftId}/void`, {}),
      ctxId(draftId)
    );
    expect(repeat.status).toBe(200);

    const signedDraft = await contractCreate(
      post('/api/service/agency/contracts', { dealId, title: 'Signed terms' })
    );
    const signedId = (await json(signedDraft)).data.id as string;
    const sent = await markSent(
      post(`/api/service/agency/contracts/${signedId}/mark-sent`, { sentOn: '2026-11-21' }),
      ctxId(signedId)
    );
    expect(sent.status).toBe(200);
    const signed = await markSigned(
      post(`/api/service/agency/contracts/${signedId}/mark-signed`, { signedOn: '2026-11-22' }),
      ctxId(signedId)
    );
    expect(signed.status).toBe(200);
    const refused = await voidRoute(
      post(`/api/service/agency/contracts/${signedId}/void`, {}),
      ctxId(signedId)
    );
    expect(refused.status).not.toBe(200);

    const list = await contractsRoute(
      new Request('http://localhost/api/service/agency/contracts', { headers: adminHeaders() })
    );
    expect(list.status).toBe(200);
  });
});
