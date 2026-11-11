import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { seedProspectTenants } from '../../src/server/db/seed/prospects';
import { seedDemoClients } from '../../src/server/db/seed/demo-clients';
import { removeDemoClients } from '../../src/server/db/seed/demo-clients-remove';
import { DEMO_CLIENT_PROFILES } from '../../src/server/db/seed/demo-client-profiles';

let db: TestDatabase;

beforeAll(async () => {
  db = await createTestDatabase();
  await seedProspectTenants(db.admin, { now: new Date('2026-11-11T12:00:00Z') });
  await db.admin`insert into users (id,email,name,email_verified,kynetic_role)
    values ('00000000-0000-4000-8000-000000000001','admin@example.test','Demo Admin',true,'admin')`;
  await db.admin`insert into tenants (id,slug,name,status,plan,timezone)
    values ('00000000-0000-4000-8000-000000000099','lane-b-control','Lane B Control','onboarding','founding','America/Chicago')`;
}, 120_000);

afterAll(async () => db?.drop());

describe('lane B demo client seed', () => {
  it('is dry-run safe, tenant-scoped, idempotent and removable', async () => {
    const profile = DEMO_CLIENT_PROFILES[0]!;
    const [snapshotsBefore] = await db.admin`select count(*)::int as n from review_snapshots
      where tenant_id=${profile.tenantId}`;
    const dry = await seedDemoClients(db.admin, {
      only: profile.slug,
      anchor: '2026-11-11',
      dryRun: true,
      noAgency: true
    });
    expect(dry[0]?.status).toBe('planned');
    expect(await db.admin`select 1 from demo_seed_records`).toHaveLength(0);

    const first = await seedDemoClients(db.admin, {
      only: profile.slug,
      anchor: '2026-11-11',
      noAgency: true
    });
    expect(first[0]?.status).toBe('seeded');
    expect(first[0]!.inserted).toBeGreaterThan(0);
    const second = await seedDemoClients(db.admin, { only: profile.slug, noAgency: true });
    expect(second[0]?.status).toBe('already_seeded');

    const [safety] = await db.admin`select
      count(*) filter (where provider <> 'fake')::int as bad_calls,
      count(*)::int as calls from calls where tenant_id=${profile.tenantId}`;
    expect(safety.bad_calls).toBe(0);
    expect(safety.calls).toBeGreaterThan(0);
    const [modules] = await db.admin`select
      bool_or(module_key='crm' and enabled and level='full') as crm,
      bool_or(module_key='opm' and enabled) as opm
      from tenant_modules where tenant_id=${profile.tenantId}`;
    expect(modules).toMatchObject({ crm: true, opm: true });
    const [metrics] = await db.admin`select count(*)::int as n from metrics_daily
      where tenant_id=${profile.tenantId} and leads > 0`;
    expect(metrics.n).toBeGreaterThan(0);
    const [jobs] = await db.admin`select to_regclass('pgboss.job') is not null as exists`;
    expect(jobs.exists).toBe(false);

    const removed = await removeDemoClients(db.admin, { only: profile.slug });
    expect(removed[0]?.status).toBe('removed');
    expect(await db.admin`select 1 from contacts where tenant_id=${profile.tenantId}`).toHaveLength(
      0
    );
    const [snapshotsAfter] = await db.admin`select count(*)::int as n from review_snapshots
      where tenant_id=${profile.tenantId}`;
    expect(snapshotsAfter.n).toBe(snapshotsBefore.n);
  }, 120_000);

  it('refuses unknown slugs and skips a tenant with a real member', async () => {
    await expect(
      seedDemoClients(db.admin, { only: 'not-allowed', noAgency: true })
    ).rejects.toThrow('unknown demo slug');
    const profile = DEMO_CLIENT_PROFILES[1]!;
    const userId = '00000000-0000-4000-8000-000000000002';
    await db.admin`insert into users (id,email,name,email_verified) values
      (${userId},'real@example.com','Real Member',true)`;
    await db.admin`insert into memberships (tenant_id,user_id,role) values
      (${profile.tenantId},${userId},'owner')`;
    const result = await seedDemoClients(db.admin, { only: profile.slug, noAgency: true });
    expect(result[0]?.status).toBe('skipped_real_member');
    await db.admin`delete from memberships where tenant_id=${profile.tenantId} and user_id=${userId}`;
    await db.admin`delete from users where id=${userId}`;
  });

  it('loads all 13 allow-listed tenants at the specified 90-day volumes', async () => {
    const [realSnapshotsBefore] =
      await db.admin`select count(*)::int as n from review_snapshots where source <> 'Demo monthly snapshot'`;
    const result = await seedDemoClients(db.admin, {
      anchor: '2026-11-11',
      noAgency: true
    });
    expect(result).toHaveLength(13);
    for (const profile of DEMO_CLIENT_PROFILES) {
      const [counts] = await db.admin`select
        (select count(*)::int from contacts where tenant_id=${profile.tenantId}) as leads,
        (select count(*)::int from calls where tenant_id=${profile.tenantId}) as calls,
        (select count(*)::int from appointments where tenant_id=${profile.tenantId}) as booked,
        (select count(*)::int from invitations where tenant_id=${profile.tenantId} and accepted_at is null) as invites`;
      expect(counts.leads).toBe(profile.leads30 * 3);
      expect(counts.calls).toBe(profile.calls30 * 3);
      expect(counts.booked).toBe(profile.booked30 * 3);
      expect(counts.invites).toBe(1);
    }
    await removeDemoClients(db.admin);
    const [realSnapshotsAfter] =
      await db.admin`select count(*)::int as n from review_snapshots where source <> 'Demo monthly snapshot'`;
    expect(realSnapshotsAfter.n).toBe(realSnapshotsBefore.n);
    expect(
      await db.admin`select 1 from tenants where id='00000000-0000-4000-8000-000000000099'`
    ).toHaveLength(1);
  }, 120_000);

  it('creates the agency workspace through the agency service without jobs', async () => {
    await seedDemoClients(db.admin, {
      only: 'demo-kynetic-agency',
      anchor: '2026-11-11'
    });
    const [workspace] = await db.admin`select t.id from tenants t
      join agency_workspaces aw on aw.tenant_id=t.id where t.slug='demo-kynetic-agency'`;
    expect(workspace).toBeTruthy();
    const [counts] = await db.admin`select
      (select count(*)::int from contacts where tenant_id=${workspace!.id}) as contacts,
      (select count(*)::int from agency_call_attempts where tenant_id=${workspace!.id}) as attempts,
      (select count(*)::int from agency_campaigns where tenant_id=${workspace!.id}) as campaigns,
      (select count(*)::int from agency_proposals where tenant_id=${workspace!.id}) as proposals,
      (select count(*)::int from agency_contracts where tenant_id=${workspace!.id}) as contracts,
      (select count(*)::int from agency_expenses where tenant_id=${workspace!.id}) as expenses,
      (select count(*)::int from agency_invoice_drafts where tenant_id=${workspace!.id}) as invoices`;
    expect(counts).toMatchObject({
      contacts: 60,
      attempts: 150,
      campaigns: 2,
      proposals: 6,
      contracts: 3,
      expenses: 8,
      invoices: 2
    });
    const removed = await removeDemoClients(db.admin, { only: 'demo-kynetic-agency' });
    expect(removed[0]?.status).toBe('removed');
    expect(await db.admin`select 1 from contacts where tenant_id=${workspace!.id}`).toHaveLength(0);
  });
});
