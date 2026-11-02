import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAgencyLead, getAgencyWorkspace } from '@/server/agency';
import {
  getAgencyProposal,
  listAgencyProposals,
  listProposalDeals,
  openAgencyProposal,
  saveAgencyProposal
} from '@/server/proposals';
import { createDb, type Db } from '@/server/db/client';
import { agencyProposals } from '@/server/db/schema';
import { stopJobs } from '@/server/jobs';
import { withTenant } from '@/server/tenancy';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';
let tdb: TestDatabase;
let db: Db;
let tenantId: string;
let dealId: string;
let draftId: string;
let clientDealId: string;
const admin = { id: IDS.admin, kyneticRole: 'admin' as const };
const content = (expectedRevision = 1, title = 'Synthetic proposal') => ({
  title,
  problem: 'Synthetic problem',
  solution: 'Synthetic agentic solution',
  roadmap: 'Synthetic roadmap',
  roi: 'Assumptions to review, no promised result.',
  expectedRevision
});
beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  const { a } = await seedTwoTenants(tdb.admin);
  clientDealId = a.dealId;
  db = createDb(tdb.app);
  Object.assign(process.env, {
    APP_BASE_URL: 'http://localhost:3000',
    DATABASE_URL: tdb.urls.app,
    DATABASE_URL_WORKER: tdb.urls.worker,
    DATABASE_URL_AUTH: tdb.authUrl,
    BETTER_AUTH_SECRET: 'synthetic-proposal-auth-00000000000000',
    APP_ENCRYPTION_KEY: 'synthetic-proposal-encryption-00000000',
    OUTBOUND_ENABLED: 'false'
  });
  tenantId = (await getAgencyWorkspace(admin, true, { db }))!.tenantId;
  dealId = (
    await createAgencyLead(
      admin,
      {
        firstName: 'Synthetic proposal lead',
        email: 'proposal@example.test',
        direction: 'inbound',
        channel: 'form'
      },
      { db }
    )
  ).dealId;
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});
describe('M17-01 F-105 internal proposal drafts', () => {
  it('opens one empty draft per agency deal under concurrent requests without side effects', async () => {
    const [before] = await tdb.admin`select stage_id from deals where id = ${dealId}`;
    const [jobsBefore] = await tdb.admin`select count(*) as n from pgboss.job`;
    const results = await Promise.all([
      openAgencyProposal(admin, dealId, { db }),
      openAgencyProposal(admin, dealId, { db })
    ]);
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    draftId = results[0]!.id;
    expect(results[0]).toMatchObject({
      status: 'draft',
      revision: 1,
      problem: '',
      solution: '',
      roadmap: '',
      roi: ''
    });
    expect(
      await tdb.admin`select id from audit_log where action = 'agency.proposal.create' and entity_id = ${draftId}`
    ).toHaveLength(1);
    expect((await listProposalDeals(admin, { db })).map((d) => d.id)).toContain(dealId);
    const [after] = await tdb.admin`select stage_id from deals where id = ${dealId}`;
    expect(after).toEqual(before);
    expect((await tdb.admin`select count(*) as n from pgboss.job`)[0]).toEqual(jobsBefore);
  });
  it('saves all four sections and actor/timestamp without copying content into audit or queue', async () => {
    const at = new Date('2026-11-01T12:00:00Z');
    const input = content();
    const row = await saveAgencyProposal(admin, draftId, input, { db, now: at });
    expect(row).toMatchObject({
      title: input.title,
      problem: input.problem,
      solution: input.solution,
      roadmap: input.roadmap,
      roi: input.roi,
      revision: 2,
      status: 'draft',
      updatedBy: IDS.admin
    });
    expect(new Date(row.updatedAt).toISOString()).toBe(at.toISOString());
    expect((await getAgencyProposal(admin, draftId, { db })).proposal.id).toBe(draftId);
    expect((await listAgencyProposals(admin, { db }))[0]?.id).toBe(draftId);
    const audits =
      await tdb.admin`select * from audit_log where action = 'agency.proposal.update' and entity_id = ${draftId}`;
    expect(audits).toHaveLength(1);
    expect(JSON.stringify(audits)).not.toContain(input.problem);
    expect(
      await tdb.admin`select id from pgboss.job where name in ('notification.email','call.outbound','automation.step')`
    ).toHaveLength(0);
  });
  it('preserves current content on reopen and treats exact lost-response retries as no-ops', async () => {
    expect((await openAgencyProposal(admin, dealId, { db })).problem).toBe(content().problem);
    expect((await saveAgencyProposal(admin, draftId, content(1), { db })).revision).toBe(2);
    expect(
      await tdb.admin`select id from audit_log where action = 'agency.proposal.update' and entity_id = ${draftId}`
    ).toHaveLength(1);
  });
  it('rejects stale edits and allows exactly one concurrent writer per revision', async () => {
    await expect(
      saveAgencyProposal(admin, draftId, content(1, 'Stale overwrite'), { db })
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    const outcomes = await Promise.allSettled([
      saveAgencyProposal(admin, draftId, content(2, 'Concurrent A'), { db }),
      saveAgencyProposal(admin, draftId, content(2, 'Concurrent B'), { db })
    ]);
    expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect((await getAgencyProposal(admin, draftId, { db })).proposal.revision).toBe(3);
  });
  it('allows partial drafts and stores HTML-looking input as plain text, never executable content', async () => {
    const row = await saveAgencyProposal(
      admin,
      draftId,
      {
        ...content(3),
        problem: '<script>synthetic()</script>',
        solution: '',
        roadmap: '',
        roi: ''
      },
      { db }
    );
    expect(row.problem).toBe('<script>synthetic()</script>');
    expect(row.solution).toBe('');
    for (const raw of [
      { ...content(4), title: '' },
      { ...content(4), problem: 'x'.repeat(6001) },
      { ...content(4), status: 'sent' },
      { ...content(4), tenantId: IDS.tenantA },
      { ...content(4), expectedRevision: -1 }
    ]) {
      await expect(saveAgencyProposal(admin, draftId, raw, { db })).rejects.toMatchObject({
        code: 'VALIDATION_FAILED'
      });
    }
  });
  it('enforces tenant/deal ownership in both service and database boundaries', async () => {
    await expect(openAgencyProposal(admin, clientDealId, { db })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    expect(
      await withTenant(ctx.ownerA(), (tx) => tx.select().from(agencyProposals), { db })
    ).toHaveLength(0);
    expect(await db.select().from(agencyProposals)).toHaveLength(0);
    for (const tenant of [IDS.tenantA, tenantId]) {
      await expect(
        withTenant(
          { tenantId, userId: IDS.admin, role: 'admin' },
          (tx) =>
            tx.insert(agencyProposals).values({
              tenantId: tenant,
              dealId: clientDealId,
              title: 'Forbidden',
              createdBy: IDS.admin,
              updatedBy: IDS.admin
            }),
          { db }
        )
      ).rejects.toThrow();
    }
    await expect(getAgencyProposal(admin, crypto.randomUUID(), { db })).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
  });
  it('hides drafts for deleted deals and rejects updates until the deal is restored', async () => {
    await tdb.admin`update deals set deleted_at = now() where id = ${dealId}`;
    try {
      expect(await listAgencyProposals(admin, { db })).toHaveLength(0);
      await expect(getAgencyProposal(admin, draftId, { db })).rejects.toMatchObject({
        code: 'NOT_FOUND'
      });
      await expect(saveAgencyProposal(admin, draftId, content(4), { db })).rejects.toMatchObject({
        code: 'NOT_FOUND'
      });
    } finally {
      await tdb.admin`update deals set deleted_at = null where id = ${dealId}`;
    }
  });
  it('rolls back the draft when audit persistence fails', async () => {
    const before = (await getAgencyProposal(admin, draftId, { db })).proposal;
    await tdb.admin
      .unsafe(`CREATE FUNCTION reject_proposal_audit() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.action = 'agency.proposal.update' THEN RAISE EXCEPTION 'synthetic failure'; END IF; RETURN NEW; END $$;
      CREATE TRIGGER reject_proposal_audit BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION reject_proposal_audit();`);
    try {
      await expect(
        saveAgencyProposal(admin, draftId, content(4, 'Must roll back'), { db })
      ).rejects.toThrow();
    } finally {
      await tdb.admin.unsafe(
        'DROP TRIGGER reject_proposal_audit ON audit_log; DROP FUNCTION reject_proposal_audit();'
      );
    }
    expect((await getAgencyProposal(admin, draftId, { db })).proposal).toEqual(before);
  });
  it('denies VA, client, forged-role and disabled admins and honors CRM Full gating', async () => {
    for (const caller of [
      { id: IDS.va, kyneticRole: 'va' as const },
      { id: IDS.ownerA, kyneticRole: null },
      { id: IDS.ownerA, kyneticRole: 'admin' as const }
    ]) {
      await expect(getAgencyProposal(caller, draftId, { db })).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
      await expect(saveAgencyProposal(caller, draftId, content(4), { db })).rejects.toMatchObject({
        code: 'FORBIDDEN'
      });
    }
    await tdb.admin`update users set disabled_at = now() where id = ${IDS.admin}`;
    try {
      await expect(listAgencyProposals(admin, { db })).rejects.toMatchObject({ code: 'FORBIDDEN' });
    } finally {
      await tdb.admin`update users set disabled_at = null where id = ${IDS.admin}`;
    }
    await tdb.admin`update tenant_modules set level = 'lite' where tenant_id = ${tenantId} and module_key = 'crm'`;
    try {
      await expect(getAgencyProposal(admin, draftId, { db })).rejects.toMatchObject({
        code: 'MODULE_DISABLED'
      });
    } finally {
      await tdb.admin`update tenant_modules set level = 'full' where tenant_id = ${tenantId} and module_key = 'crm'`;
    }
    await expect(
      withTenant(
        { tenantId, userId: IDS.admin, role: 'admin' },
        (tx) => tx.execute(sql`delete from agency_proposals where id = ${draftId}`),
        { db }
      )
    ).rejects.toThrow();
  });
});
