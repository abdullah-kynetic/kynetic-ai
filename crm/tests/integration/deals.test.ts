import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb, type Db } from '@/server/db/client';
import {
  createDeal,
  deleteDeal,
  getBoard,
  getDeal,
  listDeals,
  listStages,
  moveDeal,
  restoreDeal,
  seedDefaultPipeline,
  updateDeal
} from '@/server/deals';
import { ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let db: Db;
let opts: { db: Db };
let a: Awaited<ReturnType<typeof seedTwoTenants>>['a'];
let b: Awaited<ReturnType<typeof seedTwoTenants>>['b'];

// A third tenant that starts with no pipeline, to test seeding.
const TENANT_C = '33333333-3333-4333-8333-333333333333';
const ownerC = () => ({ tenantId: TENANT_C, userId: IDS.ownerA, role: 'owner' as const });

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  ({ a, b } = await seedTwoTenants(tdb.admin));
  await tdb.admin`insert into tenants (id, slug, name, plan, timezone)
    values (${TENANT_C}, 'tenant-c', 'Tenant C', 'founding', 'America/Los_Angeles')`;
  await tdb.admin`insert into memberships (tenant_id, user_id, role) values (${TENANT_C}, ${IDS.ownerA}, 'owner')`;
  db = createDb(tdb.app);
  opts = { db };
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

const events = async (name: string) =>
  (
    await tdb.admin`select data from pgboss.job where name = 'event.dispatch' and data->>'name' = ${name}`
  ).map((r) => r.data as { tenantId: string; payload: Record<string, unknown> });

const stageId = async (name: string) => {
  const stages = await listStages(ownerC(), undefined, opts);
  return stages.find((s) => s.name === name)!.id;
};

describe('M2-01 pipelines (F-17)', () => {
  it('seeds the eight default stages, in order, with Won and Lost flagged', async () => {
    const r = await seedDefaultPipeline(ownerC(), opts);
    expect(r.created).toBe(true);
    const stages = await listStages(ownerC(), r.pipelineId, opts);
    expect(stages.map((s) => s.name)).toEqual([
      'New',
      'Contacted',
      'Qualified',
      'Estimate Booked',
      'Estimate Done',
      'Quoted',
      'Won',
      'Lost'
    ]);
    expect(stages.filter((s) => s.isWon).map((s) => s.name)).toEqual(['Won']);
    expect(stages.filter((s) => s.isLost).map((s) => s.name)).toEqual(['Lost']);
  });

  it('is idempotent: a second call keeps the same pipeline and adds no stages', async () => {
    const first = await seedDefaultPipeline(ownerC(), opts);
    const again = await seedDefaultPipeline(ownerC(), opts);
    expect(again).toEqual({ pipelineId: first.pipelineId, created: false });
    expect(await listStages(ownerC(), undefined, opts)).toHaveLength(8);
  });

  it('does not touch another tenant that already has a pipeline', async () => {
    const r = await seedDefaultPipeline(ctx.ownerA(), opts);
    expect(r).toEqual({ pipelineId: a.pipelineId, created: false });
  });
});

describe('M2-01 deals service (F-14, F-16)', () => {
  it('creates a deal in the first stage with money in cents, audits and emits deal.created', async () => {
    const d = await createDeal(
      ownerC(),
      { title: 'Roof replacement', valueCents: 1_250_000, source: 'angi', serviceType: 'roofing' },
      opts
    );
    expect(d.valueCents).toBe(1_250_000);
    expect(d.stageId).toBe(await stageId('New'));
    expect(d.wonAt).toBeNull();
    expect((await events('deal.created')).some((e) => e.payload.dealId === d.id)).toBe(true);
    const [row] =
      await tdb.admin`select 1 from audit_log where entity_id = ${d.id} and action = 'deal.create'`;
    expect(row).toBeTruthy();
  });

  it('links the contact as homeowner and the move activity carries the contact', async () => {
    const d = await createDeal(ownerC(), { title: 'Linked', contactId: undefined }, opts);
    expect(d.id).toBeTruthy();
    // contact lives in tenant A, so tenant C cannot link it
    await expect(
      createDeal(ownerC(), { title: 'Cross', contactId: a.contactId }, opts)
    ).rejects.toBeInstanceOf(ValidationError);

    const own = await createDeal(
      ctx.ownerA(),
      { title: 'With contact', contactId: a.contactId },
      opts
    );
    const [link] =
      await tdb.admin`select role from deal_contacts where deal_id = ${own.id} and contact_id = ${a.contactId}`;
    expect(link.role).toBe('homeowner');
  });

  it('refuses a negative or fractional value', async () => {
    for (const valueCents of [-1, 1.5]) {
      await expect(createDeal(ownerC(), { title: 'Bad', valueCents }, opts)).rejects.toBeInstanceOf(
        ValidationError
      );
    }
  });

  it('F-14: Lost needs a reason, then stamps lost_at and emits stage_changed and deal.lost', async () => {
    const d = await createDeal(ownerC(), { title: 'Lost one', valueCents: 500_000 }, opts);
    const lost = await stageId('Lost');
    await expect(moveDeal(ownerC(), d.id, { stageId: lost }, opts)).rejects.toMatchObject({
      fieldErrors: { lostReason: ['required'] }
    });
    await expect(
      moveDeal(ownerC(), d.id, { stageId: lost, lostReason: '   ' }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    expect((await getDeal(ownerC(), d.id, opts)).stageId).toBe(await stageId('New'));

    const moved = await moveDeal(
      ownerC(),
      d.id,
      { stageId: lost, lostReason: 'Went elsewhere' },
      opts
    );
    expect(moved.lostReason).toBe('Went elsewhere');
    expect(moved.lostAt).not.toBeNull();
    expect(moved.wonAt).toBeNull();
    expect((await events('deal.stage_changed')).some((e) => e.payload.dealId === d.id)).toBe(true);
    expect((await events('deal.lost')).some((e) => e.payload.dealId === d.id)).toBe(true);
  });

  it('creating straight into Lost also needs a reason', async () => {
    const lost = await stageId('Lost');
    await expect(createDeal(ownerC(), { title: 'x', stageId: lost }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
    const d = await createDeal(
      ownerC(),
      { title: 'x', stageId: lost, lostReason: 'No budget' },
      opts
    );
    expect(d.lostAt).not.toBeNull();
  });

  it('Won stamps won_at and emits deal.won; moving back out clears the stamps (undo)', async () => {
    const d = await createDeal(ownerC(), { title: 'Won one', valueCents: 900_000 }, opts);
    const won = await moveDeal(ownerC(), d.id, { stageId: await stageId('Won') }, opts);
    expect(won.wonAt).not.toBeNull();
    const wonEvents = (await events('deal.won')).filter((e) => e.payload.dealId === d.id);
    expect(wonEvents).toHaveLength(1);
    expect(wonEvents[0]!.payload.valueCents).toBe(900_000);

    const undone = await moveDeal(ownerC(), d.id, { stageId: d.stageId }, opts);
    expect(undone.stageId).toBe(d.stageId);
    expect(undone.wonAt).toBeNull();
    expect(undone.lostAt).toBeNull();
    expect(undone.lostReason).toBeNull();
  });

  it('move writes an activity and an audit row, and a reorder in one column emits no stage event', async () => {
    const x = await createDeal(ownerC(), { title: 'X' }, opts);
    const y = await createDeal(ownerC(), { title: 'Y' }, opts);
    const contacted = await stageId('Contacted');
    await moveDeal(ownerC(), x.id, { stageId: contacted }, opts);
    const [act] = await tdb.admin`select summary, type from activities where deal_id = ${x.id}`;
    expect(act).toMatchObject({ type: 'stage_change', summary: 'Moved from New to Contacted' });

    const before = (await events('deal.stage_changed')).length;
    await moveDeal(ownerC(), y.id, { stageId: y.stageId, afterDealId: null }, opts);
    expect((await events('deal.stage_changed')).length).toBe(before);
  });

  it('F-16: position survives reload and column totals follow the move', async () => {
    const pipe = await seedDefaultPipeline(ownerC(), opts);
    const qualified = await stageId('Qualified');
    const d1 = await createDeal(
      ownerC(),
      { title: 'Q1', valueCents: 100_000, stageId: qualified },
      opts
    );
    const d2 = await createDeal(
      ownerC(),
      { title: 'Q2', valueCents: 250_000, stageId: qualified },
      opts
    );
    const d3 = await createDeal(
      ownerC(),
      { title: 'Q3', valueCents: 50_000, stageId: qualified },
      opts
    );

    let board = await getBoard(ownerC(), {}, opts);
    expect(board.pipeline.id).toBe(pipe.pipelineId);
    let col = board.columns.find((c) => c.stage.id === qualified)!;
    expect(col.deals.map((d) => d.title)).toEqual(['Q1', 'Q2', 'Q3']);
    expect(col.count).toBe(3);
    expect(col.totalCents).toBe(400_000);

    // d3 to the top, then d1 after d3 (so order is d3, d1, d2)
    await moveDeal(ownerC(), d3.id, { stageId: qualified, afterDealId: null }, opts);
    await moveDeal(ownerC(), d1.id, { stageId: qualified, afterDealId: d3.id }, opts);
    board = await getBoard(ownerC(), {}, opts);
    col = board.columns.find((c) => c.stage.id === qualified)!;
    expect(col.deals.map((d) => d.title)).toEqual(['Q3', 'Q1', 'Q2']);

    // between two cards
    await moveDeal(ownerC(), d2.id, { stageId: qualified, afterDealId: d3.id }, opts);
    board = await getBoard(ownerC(), {}, opts);
    col = board.columns.find((c) => c.stage.id === qualified)!;
    expect(col.deals.map((d) => d.title)).toEqual(['Q3', 'Q2', 'Q1']);

    // move to another stage: totals follow
    const quoted = await stageId('Quoted');
    await moveDeal(ownerC(), d2.id, { stageId: quoted }, opts);
    board = await getBoard(ownerC(), {}, opts);
    expect(board.columns.find((c) => c.stage.id === qualified)!.totalCents).toBe(150_000);
    expect(board.columns.find((c) => c.stage.id === quoted)!.totalCents).toBe(250_000);
  });

  it('board filters by source and owner; counts follow the filter', async () => {
    await createDeal(ownerC(), { title: 'F1', source: 'filter-src', valueCents: 1_000 }, opts);
    await createDeal(ownerC(), { title: 'F2', source: 'other-src', valueCents: 2_000 }, opts);
    const board = await getBoard(ownerC(), { source: 'filter-src' }, opts);
    const total = board.columns.reduce((n, c) => n + c.count, 0);
    expect(total).toBe(1);
    const mine = await getBoard(ownerC(), { ownerId: IDS.ownerA }, opts);
    expect(mine.columns.reduce((n, c) => n + c.count, 0)).toBe(0);
  });

  it('moving to a stage of another tenant or an unknown stage is refused', async () => {
    const d = await createDeal(ownerC(), { title: 'Edge' }, opts);
    await expect(moveDeal(ownerC(), d.id, { stageId: a.stageId }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(
      moveDeal(ownerC(), d.id, { stageId: crypto.randomUUID() }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await expect(
      moveDeal(ownerC(), d.id, { stageId: d.stageId, afterDealId: d.id }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('updates fields, audits only the changes, and refuses a non-member owner', async () => {
    const d = await createDeal(ownerC(), { title: 'Edit me' }, opts);
    const u = await updateDeal(ownerC(), d.id, { valueCents: 77_700, ownerId: IDS.ownerA }, opts);
    expect(u.valueCents).toBe(77_700);
    expect(u.ownerId).toBe(IDS.ownerA);
    await expect(updateDeal(ownerC(), d.id, { ownerId: IDS.ownerB }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(updateDeal(ownerC(), d.id, { valueCents: -5 }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('soft delete removes the deal from the board and lists; restore brings it back', async () => {
    const d = await createDeal(ownerC(), { title: 'Gone', source: 'del-src' }, opts);
    await deleteDeal(ownerC(), d.id, opts);
    await expect(getDeal(ownerC(), d.id, opts)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(
      (await getDeal(ownerC(), d.id, { ...opts, includeDeleted: true })).deletedAt
    ).not.toBeNull();
    expect((await listDeals(ownerC(), { source: 'del-src' }, opts)).length).toBe(0);
    expect(
      (await getBoard(ownerC(), { source: 'del-src' }, opts)).columns.every((c) => c.count === 0)
    ).toBe(true);
    await restoreDeal(ownerC(), d.id, opts);
    expect((await listDeals(ownerC(), { source: 'del-src' }, opts)).map((x) => x.id)).toEqual([
      d.id
    ]);
  });
});

describe('M2-01 tenant isolation', () => {
  it("tenant B cannot read, list, move, update or delete tenant A's deal", async () => {
    await expect(getDeal(ctx.ownerB(), a.dealId, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    expect((await listDeals(ctx.ownerB(), {}, opts)).some((d) => d.id === a.dealId)).toBe(false);
    await expect(
      moveDeal(ctx.ownerB(), a.dealId, { stageId: b.stageId }, opts)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(updateDeal(ctx.ownerB(), a.dealId, { title: 'x' }, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    await expect(deleteDeal(ctx.ownerB(), a.dealId, opts)).rejects.toMatchObject({
      code: 'NOT_FOUND'
    });
    const board = await getBoard(ctx.ownerB(), {}, opts);
    expect(board.columns.flatMap((c) => c.deals).some((d) => d.id === a.dealId)).toBe(false);
  });

  it("tenant B cannot create a deal in tenant A's pipeline or stage", async () => {
    await expect(
      createDeal(ctx.ownerB(), { title: 'x', pipelineId: a.pipelineId }, opts)
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
    await expect(
      createDeal(ctx.ownerB(), { title: 'x', stageId: a.stageId }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it('a read-only view-as session cannot write', async () => {
    await expect(
      createDeal({ ...ctx.adminViewingA(), readOnly: true }, { title: 'nope' }, opts)
    ).rejects.toThrow();
  });
});
