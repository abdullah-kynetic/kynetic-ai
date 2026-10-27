import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Actor } from '@/server/auth/permissions';
import { createDb, type Db } from '@/server/db/client';
import {
  createDeal,
  createStage,
  deleteStage,
  getBoard,
  listStagesWithCounts,
  moveDeal,
  reorderStages,
  seedDefaultPipeline,
  updateStage
} from '@/server/deals';
import { AppError, ValidationError } from '@/server/errors';
import { stopJobs } from '@/server/jobs';
import { ctx, IDS, seedTwoTenants } from '../helpers/fixtures';
import { createTestDatabase, type TestDatabase } from '../helpers/db';

let tdb: TestDatabase;
let opts: { db: Db };

const T1 = '33333333-3333-4333-8333-333333333333'; // crm lite, owner
const T2 = '44444444-4444-4444-8444-444444444444'; // no crm
const owner = (t = T1) => ({ tenantId: t, userId: IDS.ownerA, role: 'owner' as const });
const actorOf = (t: string, role: 'owner' | 'staff'): Actor => ({
  userId: IDS.ownerA,
  kyneticRole: null,
  membership: { tenantId: t, role, canExport: false, canBulkDelete: false },
  viewAs: null
});

beforeAll(async () => {
  tdb = await createTestDatabase({ jobs: true });
  await seedTwoTenants(tdb.admin);
  for (const [id, slug] of [
    [T1, 'tenant-c'],
    [T2, 'tenant-d']
  ]) {
    await tdb.admin`insert into tenants (id, slug, name, plan, timezone)
      values (${id}, ${slug}, ${slug}, 'founding', 'America/Los_Angeles')`;
    await tdb.admin`insert into memberships (tenant_id, user_id, role) values (${id}, ${IDS.ownerA}, 'owner')`;
  }
  await tdb.admin`insert into tenant_modules (tenant_id, module_key, enabled, level) values (${T1}, 'crm', true, 'lite')`;
  opts = { db: createDb(tdb.app) };
  process.env.APP_BASE_URL = 'http://localhost:3000';
  process.env.DATABASE_URL = tdb.urls.app;
  process.env.DATABASE_URL_WORKER = tdb.urls.worker;
  process.env.DATABASE_URL_AUTH = tdb.authUrl;
  process.env.BETTER_AUTH_SECRET = 'x'.repeat(32);
  process.env.APP_ENCRYPTION_KEY = 'y'.repeat(32);
  await seedDefaultPipeline(owner(T1), opts);
  await seedDefaultPipeline(owner(T2), opts);
});
afterAll(async () => {
  await stopJobs();
  await tdb?.drop();
});

const names = (rows: { name: string }[]) => rows.map((r) => r.name);
const A = () => actorOf(T1, 'owner');
const idOf = async (name: string) =>
  (await listStagesWithCounts(owner(), undefined, opts)).find((s) => s.name === name)!.id;

describe('M2-05 configurable stages (F-17, F-43)', () => {
  it('renames a stage; the deal keeps its stage and the board shows the new name', async () => {
    const deal = await createDeal(
      owner(),
      { title: 'Roof A', stageId: await idOf('Quoted') },
      opts
    );
    await updateStage(owner(), A(), deal.stageId, { name: 'Proposal sent' }, opts);
    const board = await getBoard(owner(), {}, opts);
    const col = board.columns.find((c) => c.stage.name === 'Proposal sent')!;
    expect(col.deals.map((d) => d.id)).toEqual([deal.id]);
    await updateStage(owner(), A(), deal.stageId, { name: 'Quoted' }, opts);
  });

  it('refuses a duplicate name in any letter case', async () => {
    const id = await idOf('Contacted');
    await expect(updateStage(owner(), A(), id, { name: 'new' }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
    await expect(createStage(owner(), A(), { name: 'QUALIFIED' }, opts)).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it('adds a stage before Won and Lost', async () => {
    const rows = await createStage(owner(), A(), { name: 'Site visit' }, opts);
    expect(names(rows)).toEqual([
      'New',
      'Contacted',
      'Qualified',
      'Estimate Booked',
      'Estimate Done',
      'Quoted',
      'Site visit',
      'Won',
      'Lost'
    ]);
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('reorders and rejects a list that misses a stage', async () => {
    const rows = await listStagesWithCounts(owner(), undefined, opts);
    const ids = rows.map((r) => r.id);
    const swapped = [ids[1]!, ids[0]!, ...ids.slice(2)];
    const out = await reorderStages(owner(), A(), { stageIds: swapped }, opts);
    expect(out.slice(0, 2).map((r) => r.name)).toEqual(['Contacted', 'New']);
    await expect(
      reorderStages(owner(), A(), { stageIds: ids.slice(1) }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    await reorderStages(owner(), A(), { stageIds: ids }, opts);
  });

  it('delete with deals needs an open target stage, then moves them in order', async () => {
    const site = await idOf('Site visit');
    const d1 = await createDeal(owner(), { title: 'One', stageId: site }, opts);
    const d2 = await createDeal(owner(), { title: 'Two', stageId: site }, opts);
    await expect(deleteStage(owner(), A(), site, {}, opts)).rejects.toBeInstanceOf(ValidationError);
    await expect(
      deleteStage(owner(), A(), site, { moveToStageId: await idOf('Won') }, opts)
    ).rejects.toBeInstanceOf(ValidationError);
    const target = await idOf('Qualified');
    const rows = await deleteStage(owner(), A(), site, { moveToStageId: target }, opts);
    expect(names(rows)).not.toContain('Site visit');
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => i));
    const col = (await getBoard(owner(), {}, opts)).columns.find((c) => c.stage.id === target)!;
    const ids = col.deals.map((d) => d.id);
    expect(ids.indexOf(d1.id)).toBeLessThan(ids.indexOf(d2.id));
    // The deal moves again afterwards like any other.
    await moveDeal(owner(), d1.id, { stageId: await idOf('New') }, opts);
  });

  it('deletes an empty stage without a target and never a Won or Lost stage', async () => {
    const [{ id }] = (await createStage(owner(), A(), { name: 'Temp' }, opts)).filter(
      (s) => s.name === 'Temp'
    );
    await deleteStage(owner(), A(), id!, {}, opts);
    await expect(deleteStage(owner(), A(), await idOf('Won'), {}, opts)).rejects.toMatchObject({
      code: 'CONFLICT'
    });
    await expect(deleteStage(owner(), A(), await idOf('Lost'), {}, opts)).rejects.toMatchObject({
      code: 'CONFLICT'
    });
  });

  it('staff cannot change stages; the audit log records owner changes', async () => {
    await expect(
      createStage(ctx.staffA(), actorOf(IDS.tenantA, 'staff'), { name: 'X' }, opts)
    ).rejects.toBeInstanceOf(AppError);
    const staffCtx = { ...owner(), role: 'staff' as const };
    await expect(
      createStage(staffCtx, actorOf(T1, 'staff'), { name: 'X' }, opts)
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const rows = await tdb.admin`select action from audit_log where tenant_id = ${T1}
      and action like 'pipeline_stage.%'`;
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ['create', 'update', 'reorder', 'delete']) {
      expect(actions.has(`pipeline_stage.${a}`)).toBe(true);
    }
  });

  it('a tenant without crm lite gets MODULE_DISABLED and nothing is written', async () => {
    const before =
      await tdb.admin`select count(*)::int as n from pipeline_stages where tenant_id = ${T2}`;
    await expect(
      createStage(owner(T2), actorOf(T2, 'owner'), { name: 'Nope' }, opts)
    ).rejects.toMatchObject({ code: 'MODULE_DISABLED' });
    await expect(listStagesWithCounts(owner(T2), undefined, opts)).rejects.toMatchObject({
      code: 'MODULE_DISABLED'
    });
    const after =
      await tdb.admin`select count(*)::int as n from pipeline_stages where tenant_id = ${T2}`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("tenant A's owner cannot touch tenant C's stage (404)", async () => {
    const other = await idOf('New');
    await expect(
      updateStage(ctx.ownerA(), actorOf(IDS.tenantA, 'owner'), other, { name: 'Hacked' }, opts)
    ).rejects.toMatchObject({ code: expect.stringMatching(/NOT_FOUND|MODULE_DISABLED/) });
  });
});
