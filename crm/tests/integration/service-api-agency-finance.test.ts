import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { getAgencyWorkspace } from '@/server/agency';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { issueServiceToken, ADMIN_CLIENT_HEADER } from '@/server/service-auth';
import { GET as financeRoute } from '@/app/api/service/agency/finance/route';
import { GET as summaryRoute } from '@/app/api/service/agency/finance/summary/route';
import { POST as expenseCreate } from '@/app/api/service/agency/expenses/route';
import { PATCH as expenseEdit } from '@/app/api/service/agency/expenses/[id]/route';
import { POST as revenueCreate } from '@/app/api/service/agency/revenue/route';
import { POST as invoiceDraft } from '@/app/api/service/agency/billing/invoices/route';
import { IDS, ctx } from '../helpers/fixtures';
import { setupAgency, agencyAdmin } from '../helpers/agency';

// D3: finance records through the owner's admin key. Money is integer cents. Invoices are drafts only;
// a body with extra fields (for example a charge) is refused.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let db: Db;
let adminKey: string;
let agencySlug = '';
let keyN = 0;
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';

const h = (extra: Record<string, string>, key: string | null = `d3-${Date.now()}-${keyN++}`) => ({
  'content-type': 'application/json',
  ...extra,
  ...(key ? { 'idempotency-key': key } : {})
});
const adminHeaders = (): Record<string, string> => ({
  authorization: `Bearer ${adminKey}`,
  [ADMIN_CLIENT_HEADER]: agencySlug
});
const post = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: h(adminHeaders()),
    body: JSON.stringify(body)
  });
const patch = (url: string, body: unknown) =>
  new Request(`http://localhost${url}`, {
    method: 'PATCH',
    headers: h(adminHeaders()),
    body: JSON.stringify(body)
  });
const ctxId = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  setup = await setupAgency();
  db = setup.db;
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  agencySlug = (await getAgencyWorkspace(agencyAdmin, true, { db }))!.slug;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  adminKey = (await issueAdminKey(owner, { label: 'd3', allowedCidrs: [] }, { db, ownerEmail }))
    .key;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

describe('service API agency finance (D3)', () => {
  it('refuses a client token on finance', async () => {
    const client = await issueServiceToken(
      ctx.ownerA(),
      { label: 'c', scopes: ['deals:read'] },
      { db }
    );
    const res = await financeRoute(
      new Request('http://localhost/api/service/agency/finance', {
        headers: { authorization: `Bearer ${client.token}` }
      })
    );
    expect(res.status).toBe(403);
  });

  it('adds revenue and an expense, and the month summary adds them up in cents', async () => {
    const rev = await revenueCreate(
      post('/api/service/agency/revenue', {
        receivedOn: '2026-11-05',
        amountCents: 100000,
        note: 'Test'
      })
    );
    expect(rev.status, JSON.stringify(await rev.clone().json())).toBe(201);
    const exp = await expenseCreate(
      post('/api/service/agency/expenses', {
        spentOn: '2026-11-06',
        vendor: 'Lead list vendor',
        category: 'data',
        amountCents: 30000
      })
    );
    expect(exp.status).toBe(201);

    const res = await summaryRoute(
      new Request('http://localhost/api/service/agency/finance/summary?month=2026-11', {
        headers: adminHeaders()
      })
    );
    const data = (await res.json()).data;
    expect(data).toMatchObject({
      month: '2026-11',
      revenueCents: 100000,
      expenseCents: 30000,
      netCents: 70000
    });
  });

  it('edits an expense and writes an audit row with the change', async () => {
    const created = await expenseCreate(
      post('/api/service/agency/expenses', {
        spentOn: '2026-11-07',
        vendor: 'Tools',
        category: 'software',
        amountCents: 5000
      })
    );
    const id = (await created.json()).data.id as string;
    const edited = await expenseEdit(
      patch(`/api/service/agency/expenses/${id}`, {
        spentOn: '2026-11-07',
        vendor: 'Tools',
        category: 'software',
        amountCents: 6000
      }),
      ctxId(id)
    );
    expect(edited.status).toBe(200);
    const audits = await setup.test
      .admin`select count(*)::int n from audit_log where action = 'agency.expense.update' and entity_id = ${id}`;
    expect(audits[0]!.n).toBeGreaterThan(0);
  });

  it('refuses an invoice body with extra fields, such as a charge', async () => {
    const res = await invoiceDraft(
      post('/api/service/agency/billing/invoices', {
        dealId: '00000000-0000-4000-8000-000000000001',
        kind: 'setup',
        dueOn: '2026-12-01',
        charge: true
      })
    );
    expect(res.status).toBe(400);
  });
});
