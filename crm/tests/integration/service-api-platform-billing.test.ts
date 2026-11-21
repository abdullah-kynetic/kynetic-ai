import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { issueAdminKey } from '@/server/admin/admin-api-keys';
import { GET as billingRoute } from '@/app/api/service/platform/billing/route';
import { GET as clientBillingRoute } from '@/app/api/service/platform/clients/[id]/billing/route';
import { PUT as planRoute } from '@/app/api/service/platform/clients/[id]/plan/route';
import { PATCH as profileRoute } from '@/app/api/service/platform/clients/[id]/billing-profile/route';
import { GET as usageRoute } from '@/app/api/service/platform/usage/route';
import { POST as onboardRoute } from '@/app/api/service/platform/clients/route';
import { IDS } from '../helpers/fixtures';
import { setupAgency } from '../helpers/agency';

// E2: billing, plans, billing profile and usage, through the owner's admin key. No charge, no invoice email.

let setup: Awaited<ReturnType<typeof setupAgency>>;
let adminKey: string;
let clientId = '';
const owner = { id: IDS.admin, kyneticRole: 'admin' as const };
const ownerEmail = 'admin@example.test';
const bearer = () => ({ authorization: `Bearer ${adminKey}`, 'content-type': 'application/json' });

beforeAll(async () => {
  setup = await setupAgency();
  await setup.test.admin`insert into users (id, email, kynetic_role, email_verified) values
    (${IDS.admin}, ${ownerEmail}, 'admin', true) on conflict (id) do update set email_verified = true`;
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = setup.db;
  adminKey = (
    await issueAdminKey(owner, { label: 'e2', allowedCidrs: [] }, { db: setup.db, ownerEmail })
  ).key;
  const created = await onboardRoute(
    new Request('http://localhost/api/service/platform/clients', {
      method: 'POST',
      headers: bearer(),
      body: JSON.stringify({
        businessName: 'E2 Billing Co',
        ownerEmail: 'owner-e2@example.test',
        phone: '+12025550101',
        industry: 'roofing',
        timezone: 'America/Chicago',
        hours: { days: ['mon'], open: '08:00', close: '17:00' },
        plan: 'value',
        modules: []
      })
    })
  );
  clientId = (await created.json()).data.tenantId as string;
});
afterAll(async () => {
  await stopJobs();
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await setup?.close();
});

describe('service API platform billing (E2)', () => {
  it('reads every client billing with totals in cents', async () => {
    const res = await billingRoute(
      new Request('http://localhost/api/service/platform/billing', { headers: bearer() })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data.clients)).toBe(true);
    expect(typeof body.data.totals.monthlyCents).toBe('number');
  });

  it('reads one client billing and changes its plan and billing profile', async () => {
    const view = await clientBillingRoute(
      new Request(`http://localhost/api/service/platform/clients/${clientId}/billing`, {
        headers: bearer()
      }),
      { params: Promise.resolve({ id: clientId }) }
    );
    expect(view.status).toBe(200);
    const plan = await planRoute(
      new Request(`http://localhost/api/service/platform/clients/${clientId}/plan`, {
        method: 'PUT',
        headers: bearer(),
        body: JSON.stringify({ plan: 'founding' })
      }),
      { params: Promise.resolve({ id: clientId }) }
    );
    expect(plan.status).toBe(200);
    const empty = await planRoute(
      new Request(`http://localhost/api/service/platform/clients/${clientId}/plan`, {
        method: 'PUT',
        headers: bearer(),
        body: JSON.stringify({})
      }),
      { params: Promise.resolve({ id: clientId }) }
    );
    expect(empty.status).toBe(400);
    const profile = await profileRoute(
      new Request(`http://localhost/api/service/platform/clients/${clientId}/billing-profile`, {
        method: 'PATCH',
        headers: bearer(),
        body: JSON.stringify({ notes: 'Set up by test' })
      }),
      { params: Promise.resolve({ id: clientId }) }
    );
    expect(profile.status).toBe(200);
  });

  it('reads usage for a month and refuses a bad month', async () => {
    const ok = await usageRoute(
      new Request('http://localhost/api/service/platform/usage?month=2026-11', {
        headers: bearer()
      })
    );
    expect(ok.status).toBe(200);
    const bad = await usageRoute(
      new Request('http://localhost/api/service/platform/usage?month=November', {
        headers: bearer()
      })
    );
    expect(bad.status).toBe(400);
  });
});
