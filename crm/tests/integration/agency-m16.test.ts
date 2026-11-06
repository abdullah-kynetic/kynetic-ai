import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AGENCY_SOURCES,
  AGENCY_STAGES,
  createAgencyLead,
  getAgencyPipeline,
  getAgencyWorkspace,
  listAgencyLeads,
  moveAgencyDeal,
  renameAgencyStage
} from '@/server/agency';
import { createDb, type Db } from '@/server/db/client';
import { agencyWorkspaces, contacts } from '@/server/db/schema';
import { findNonSeedTenants } from '@/server/preview/guard';
import { stopJobs } from '@/server/jobs';
import { withTenant } from '@/server/tenancy';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';

let tdb: TestDatabase;
let db: Db;
let tenantId: string;
let client: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
const admin = { id: IDS.admin, kyneticRole: 'admin' as const };
beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a: client } = await seedTwoTenants(tdb.admin));
  db = createDb(tdb.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'synthetic-agency-auth-key-000000000000',
    APP_ENCRYPTION_KEY: 'synthetic-agency-encryption-key-0000000',
    OUTBOUND_ENABLED: 'false'
  });
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('M16-01/M16-02/M16-05 F-05/F-14/F-17 isolated agency workspace', () => {
  it('rolls back the whole setup if workspace registration fails', async () => {
    expect(await getAgencyWorkspace(admin, false, { db })).toBeNull();
    await tdb.admin
      .unsafe(`CREATE FUNCTION reject_agency_setup() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$;
      CREATE TRIGGER reject_agency_setup BEFORE INSERT ON agency_workspaces FOR EACH ROW EXECUTE FUNCTION reject_agency_setup();`);
    try {
      await expect(getAgencyWorkspace(admin, true, { db })).rejects.toThrow();
    } finally {
      await tdb.admin.unsafe(
        'DROP TRIGGER reject_agency_setup ON agency_workspaces; DROP FUNCTION reject_agency_setup();'
      );
    }
    expect(await tdb.admin`select id from tenants where slug = 'demo-kynetic-agency'`).toHaveLength(
      0
    );
  });
  it('creates exactly one tenant under concurrent requests, with no sends, invites or credentials', async () => {
    const results = await Promise.all([
      getAgencyWorkspace(admin, true, { db }),
      getAgencyWorkspace(admin, true, { db }),
      getAgencyWorkspace(admin, true, { db })
    ]);
    expect(results.filter((r) => r?.created)).toHaveLength(1);
    expect(new Set(results.map((r) => r!.tenantId)).size).toBe(1);
    tenantId = results[0]!.tenantId;
    const [tenant] =
      await tdb.admin`select name, slug, timezone from tenants where id = ${tenantId}`;
    expect(await findNonSeedTenants(tdb.admin)).toEqual(['tenant-a', 'tenant-b']);
    expect(tenant).toEqual({
      name: 'Kynetic AI (synthetic)',
      slug: 'demo-kynetic-agency',
      timezone: 'UTC'
    });
    const [platform] =
      await tdb.admin`select config from tenant_modules where tenant_id = ${tenantId} and module_key = 'platform'`;
    expect(platform!.config.outbound_kill_switch).toBe(true);
    const [alex] = await tdb.admin`select paused from alex_configs where tenant_id = ${tenantId}`;
    expect(alex!.paused).toBe(true);
    for (const table of ['invitations', 'tenant_secrets', 'consents', 'calls', 'messages']) {
      expect(
        await tdb.admin.unsafe(`select id from ${table} where tenant_id = $1`, [tenantId])
      ).toHaveLength(0);
    }
    expect(
      await tdb.admin`select id from audit_log where tenant_id = ${tenantId} and action = 'agency.workspace.create'`
    ).toHaveLength(1);
  });
  it('seeds the agreed seven stages once and preserves custom edits on repeated setup', async () => {
    const initial = await getAgencyPipeline(admin, { db });
    expect(initial.stages.map((s) => s.name)).toEqual([...AGENCY_STAGES]);
    expect(initial.stages.find((s) => s.isWon)?.name).toBe('Won');
    expect(initial.stages.find((s) => s.isLost)?.name).toBe('Lost');
    await renameAgencyStage(admin, initial.stages[0]!.id, 'New opportunity', { db });
    await getAgencyWorkspace(admin, true, { db });
    expect((await getAgencyPipeline(admin, { db })).stages[0]!.name).toBe('New opportunity');
    expect(
      await tdb.admin`select id from pipeline_stages where tenant_id = ${tenantId}`
    ).toHaveLength(7);
  });
  it('creates/filter/counts all source categories without starting outreach or recording consent', async () => {
    for (const [direction, channel] of AGENCY_SOURCES) {
      await createAgencyLead(
        admin,
        {
          firstName: `Synthetic ${channel}`,
          email: `${direction}-${channel}@example.test`,
          direction,
          channel
        },
        { db }
      );
    }
    const data = await listAgencyLeads(admin, {}, { db });
    expect(data.leads).toHaveLength(11);
    expect(data.counts.every((c) => c.count === 1)).toBe(true);
    expect((await listAgencyLeads(admin, { direction: 'outbound' }, { db })).leads).toHaveLength(4);
    expect((await listAgencyLeads(admin, { channel: 'cold_call' }, { db })).leads).toHaveLength(1);
    expect(
      (await listAgencyLeads(admin, { direction: 'inbound', channel: 'cold_call' }, { db })).leads
    ).toHaveLength(0);
    expect(
      await tdb.admin`select id from pgboss.job where data->>'tenantId' = ${tenantId} and data->>'name' = 'lead.created'`
    ).toHaveLength(0);
    expect(await tdb.admin`select id from consents where tenant_id = ${tenantId}`).toHaveLength(0);
    expect(
      await tdb.admin`select id from pgboss.job where name in ('call.outbound', 'automation.step', 'notification.email')`
    ).toHaveLength(0);
  });
  it('rejects real addresses, inconsistent source pairs and duplicate contacts', async () => {
    await expect(
      createAgencyLead(
        admin,
        {
          firstName: 'Synthetic',
          email: 'real@example.com',
          direction: 'inbound',
          channel: 'form'
        },
        { db }
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      createAgencyLead(
        admin,
        {
          firstName: 'Synthetic',
          email: 'new@example.test',
          direction: 'inbound',
          channel: 'cold_call'
        },
        { db }
      )
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await expect(
      createAgencyLead(
        admin,
        {
          firstName: 'Duplicate',
          email: 'inbound-form@example.test',
          direction: 'inbound',
          channel: 'form'
        },
        { db }
      )
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });
  it('moves an agency deal through existing audited CRM services without touching a client pipeline', async () => {
    const lead = (await listAgencyLeads(admin, {}, { db })).leads[0]!;
    const pipeline = await getAgencyPipeline(admin, { db });
    const stage = pipeline.stages.find((s) => s.name === 'Interested')!;
    await moveAgencyDeal(admin, lead.deal!.dealId, stage.id, { db });
    const [changed] = await tdb.admin`select stage_id from deals where id = ${lead.deal!.dealId}`;
    expect(changed!.stage_id).toBe(stage.id);
    expect(
      await tdb.admin`select id from activities where tenant_id = ${tenantId} and deal_id = ${lead.deal!.dealId} and type = 'stage_change'`
    ).toHaveLength(1);
    await expect(moveAgencyDeal(admin, client.dealId, stage.id, { db })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(
      renameAgencyStage(admin, client.stageId, 'Forbidden change', { db })
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    const [untouched] =
      await tdb.admin`select name from pipeline_stages where id = ${client.stageId}`;
    expect(untouched!.name).toBe('New');
  });
  it('enforces client/agency RLS and never allows a forged agency marker', async () => {
    expect(
      await withTenant(ctx.ownerA(), (tx) => tx.select().from(agencyWorkspaces), { db })
    ).toHaveLength(0);
    const agencyRows = await withTenant(
      { tenantId, userId: IDS.admin, role: 'admin' },
      (tx) => tx.select().from(contacts),
      { db }
    );
    expect(agencyRows.every((r) => r.tenantId === tenantId)).toBe(true);
    await expect(
      withTenant(
        ctx.ownerA(),
        (tx) =>
          tx
            .insert(agencyWorkspaces)
            .values({ tenantId: IDS.tenantA, workspaceKey: 'kynetic_synthetic' }),
        { db }
      )
    ).rejects.toThrow();
    expect(await withTenant(ctx.ownerA(), (tx) => tx.select().from(contacts), { db })).toHaveLength(
      1
    );
  });
  it('refuses VA, owner, forged-role, disabled admin and impersonation contexts', async () => {
    for (const caller of [
      { id: IDS.va, kyneticRole: 'va' as const },
      { id: IDS.ownerA, kyneticRole: null },
      { id: IDS.ownerA, kyneticRole: 'admin' as const }
    ]) {
      await expect(getAgencyWorkspace(caller, true, { db })).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      await expect(listAgencyLeads(caller, {}, { db })).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
    }
    await tdb.admin`update users set disabled_at = now() where id = ${IDS.admin}`;
    try {
      await expect(getAgencyWorkspace(admin, false, { db })).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
    } finally {
      await tdb.admin`update users set disabled_at = null where id = ${IDS.admin}`;
    }
    await expect(
      withTenant(
        { tenantId, userId: IDS.admin, role: 'admin', impersonatorId: IDS.admin },
        (tx) => tx.execute(sql`select * from admin_agency_workspace(false)`),
        { db }
      )
    ).rejects.toThrow();
  });
  it('denies agency features when CRM is disabled without affecting a client tenant', async () => {
    await tdb.admin`update tenant_modules set enabled = false where tenant_id = ${tenantId} and module_key = 'crm'`;
    try {
      await expect(listAgencyLeads(admin, {}, { db })).rejects.toMatchObject({
        code: 'MODULE_DISABLED'
      });
    } finally {
      await tdb.admin`update tenant_modules set enabled = true where tenant_id = ${tenantId} and module_key = 'crm'`;
    }
  });
});
