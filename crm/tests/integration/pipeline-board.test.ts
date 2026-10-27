import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import { createDeal, getBoardView, listStages, moveDeal } from '@/server/deals';
import { stopJobs } from '@/server/jobs';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a } = await seedTwoTenants(tdb.admin));
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

describe('M2-02 kanban board view (F-16)', () => {
  it('adds contact names, overdue deals, owners and sources to the board', async () => {
    const withContact = await createDeal(
      ctx.ownerA(),
      { title: 'Roof', valueCents: 120_000, source: 'Google', contactId: a.contactId },
      opts
    );
    const late = await createDeal(ctx.ownerA(), { title: 'Late', source: 'Referral' }, opts);
    const fine = await createDeal(ctx.ownerA(), { title: 'Fine' }, opts);
    await tdb.admin`insert into tasks (tenant_id, title, due_at, deal_id)
      values (${IDS.tenantA}, 'Call back', now() - interval '1 day', ${late.id}),
             (${IDS.tenantA}, 'Done already', now() - interval '1 day', ${fine.id})`;
    await tdb.admin`update tasks set completed_at = now() where title = 'Done already'`;

    const view = await getBoardView(ctx.ownerA(), {}, opts);
    expect(view.contactNames[withContact.id]).toBeTruthy();
    expect(view.contactNames[late.id]).toBeUndefined();
    expect(view.overdueDealIds).toEqual([late.id]);
    expect(view.filters.owners.map((o) => o.id)).toContain(IDS.ownerA);
    expect(view.filters.owners.map((o) => o.id)).not.toContain(IDS.ownerB);
    expect(view.filters.sources).toEqual(expect.arrayContaining(['Google', 'Referral']));
  });

  it('a move persists, shows in the next board read, and undo restores it', async () => {
    const d = await createDeal(ctx.ownerA(), { title: 'Mover', valueCents: 70_000 }, opts);
    await tdb.admin`insert into pipeline_stages (tenant_id, pipeline_id, name, position)
      values (${IDS.tenantA}, ${a.pipelineId}, 'Qualified', 5)`;
    const stages = await listStages(ctx.ownerA(), undefined, opts);
    const to = stages.find((s) => s.name === 'Qualified')!;
    await moveDeal(ctx.ownerA(), d.id, { stageId: to.id }, opts);
    let view = await getBoardView(ctx.ownerA(), {}, opts);
    expect(view.columns.find((c) => c.stage.id === to.id)!.deals.map((x) => x.id)).toContain(d.id);
    await moveDeal(ctx.ownerA(), d.id, { stageId: d.stageId, afterDealId: null }, opts);
    view = await getBoardView(ctx.ownerA(), {}, opts);
    expect(view.columns.find((c) => c.stage.id === to.id)!.deals.map((x) => x.id)).not.toContain(
      d.id
    );
    const events = await tdb.admin`select 1 from pgboss.job
      where name = 'event.dispatch' and data->>'name' = 'deal.stage_changed'
        and data->'payload'->>'dealId' = ${d.id}`;
    expect(events).toHaveLength(2);
  });

  it("tenant B's board never shows tenant A's deals or names", async () => {
    const view = await getBoardView(ctx.ownerB(), {}, opts);
    const ids = view.columns.flatMap((c) => c.deals.map((x) => x.id));
    expect(ids).not.toContain(a.dealId);
    expect(Object.keys(view.contactNames).every((id) => ids.includes(id))).toBe(true);
    expect(view.filters.owners.map((o) => o.id)).not.toContain(IDS.ownerA);
  });
});
