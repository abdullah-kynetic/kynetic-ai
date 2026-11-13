import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { onboardTenant } from '@/server/admin/onboarding';
import { provisionClientAutomations } from '@/server/admin';
import { createDb, type Db } from '@/server/db/client';
import { stopJobs } from '@/server/jobs';
import { handleLeadIntake, signLeadBody } from '@/server/leads';
import { authenticateServiceToken } from '@/server/service-auth';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let wdb: Db;
let tenantId: string;
const staff = { id: IDS.admin, kyneticRole: 'admin' as const };
const va = { id: IDS.va, kyneticRole: 'va' as const };

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  await tdb.admin`insert into automation_templates (key, module_key, label) values
    ('quote_followup','quote_followup','Quote follow-up'), ('reactivation','reactivation','Reactivation') on conflict do nothing`;
  db = createDb(tdb.app);
  wdb = createDb(tdb.worker);
  Object.assign(process.env, {
    APP_BASE_URL: 'https://portal.example.test',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'x'.repeat(32),
    APP_ENCRYPTION_KEY: 'y'.repeat(32)
  });
  (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb = db;
  const r = await onboardTenant(
    { userId: IDS.admin, role: 'admin' },
    {
      businessName: 'Onboard Demo Remodeling',
      ownerEmail: 'owner@onboard-demo.test',
      phone: '(415) 555-0100',
      industry: 'roofing',
      timezone: 'America/Los_Angeles',
      hours: { days: ['mon', 'tue', 'wed', 'thu', 'fri'], open: '08:00', close: '17:00' },
      serviceZips: ['94107'],
      plan: 'founding',
      tier: 'T2',
      modules: ['alex_core', 'quote_followup', 'reactivation']
    },
    { db }
  );
  tenantId = r.tenantId;
});
afterAll(async () => {
  delete (globalThis as typeof globalThis & { __kyneticDb?: Db }).__kyneticDb;
  await stopJobs();
  await tdb?.drop();
});

describe('new client onboarding automation', () => {
  it('only an admin can run it', async () => {
    await expect(provisionClientAutomations(va, tenantId, { db: wdb })).rejects.toMatchObject({
      code: 'FORBIDDEN'
    });
  });

  it('installs default copy off, creates the lead secret and booking token once, and sends nothing', async () => {
    const r = await provisionClientAutomations(staff, tenantId, { db: wdb });
    expect(r.sequencesInstalled.sort()).toEqual(['quote_followup', 'reactivation']);
    expect(r.leadSecret).toBeTruthy();
    expect(r.bookingToken).toBeTruthy();
    expect(JSON.stringify(r.n8nSheet)).not.toContain(r.leadSecret!);
    expect(JSON.stringify(r.n8nSheet)).not.toContain(r.bookingToken!);
    expect(r.n8nSheet.leadHookUrl).toBe(`https://portal.example.test/api/hooks/leads/${tenantId}`);

    const autos =
      await tdb.admin`select template_key, enabled from automations where tenant_id = ${tenantId}`;
    expect(autos.every((a) => a.enabled === false)).toBe(true);
    const steps =
      await tdb.admin`select count(*)::int as n from automation_steps where tenant_id = ${tenantId}`;
    expect(steps[0].n).toBe(3);
    const versions =
      await tdb.admin`select status from automation_versions where tenant_id = ${tenantId}`;
    expect(versions.map((v) => v.status)).toEqual(['approved', 'approved']);
    const [outbound] =
      await tdb.admin`select (select count(*)::int from messages where tenant_id = ${tenantId}) as m,
      (select count(*)::int from calls where tenant_id = ${tenantId}) as c`;
    expect(outbound).toEqual({ m: 0, c: 0 });
    const [a] =
      await tdb.admin`select count(*)::int as n from audit_log where tenant_id = ${tenantId} and action = 'tenant.provision_automation'`;
    expect(a.n).toBe(1);
  });

  it('the secret and token it returned work', async () => {
    // Fresh tenant state: rotate-free check using a second onboarding is overkill; re-read from the first run is impossible,
    // so provision a second client and use its values.
    const r2 = await onboardTenant(
      { userId: IDS.admin, role: 'admin' },
      {
        businessName: 'Second Demo Remodeling',
        ownerEmail: 'owner@second-demo.test',
        phone: '(415) 555-0101',
        industry: 'roofing',
        timezone: 'America/Los_Angeles',
        hours: { days: ['mon'], open: '08:00', close: '17:00' },
        serviceZips: ['94107'],
        plan: 'founding',
        tier: 'T2',
        modules: ['alex_core']
      },
      { db }
    );
    const p = await provisionClientAutomations(staff, r2.tenantId, { db: wdb });
    const raw = JSON.stringify({ externalId: 'onb-1', source: 'form', phone: '+15555550155' });
    const ts = Math.floor(Date.now() / 1000);
    const res = await handleLeadIntake(
      new Request(p.n8nSheet.leadHookUrl, {
        method: 'POST',
        body: raw,
        headers: {
          'x-kynetic-timestamp': String(ts),
          'x-kynetic-signature': signLeadBody(p.leadSecret!, ts, raw)
        }
      }),
      r2.tenantId,
      { db }
    );
    expect(res.status).toBe(200);
    const svc = await authenticateServiceToken(`Bearer ${p.bookingToken}`, { db });
    expect(svc).toMatchObject({ tenantId: r2.tenantId });
    expect(svc?.scopes.sort()).toEqual(['appointments:write', 'calls:write']);
  });

  it('running it again changes nothing and returns no secrets', async () => {
    const again = await provisionClientAutomations(staff, tenantId, { db: wdb });
    expect(again).toMatchObject({ sequencesInstalled: [], leadSecret: null, bookingToken: null });
    const [n] =
      await tdb.admin`select count(*)::int as n from service_tokens where tenant_id = ${tenantId}`;
    expect(n.n).toBe(1);
  });
});
