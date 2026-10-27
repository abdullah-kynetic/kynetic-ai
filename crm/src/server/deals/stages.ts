import { and, asc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { audit } from '../audit';
import { can, type Actor } from '../auth/permissions';
import type { Tx } from '../db/client';
import { deals, pipelineStages } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { isModuleEnabled } from '../modules';
import type { TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { positionBetween } from './position';
import { loadPipeline, notFound, run, type DealOpts, type Stage } from './pipelines';
import {
  createStageSchema,
  deleteStageSchema,
  reorderStagesSchema,
  updateStageSchema,
  type CreateStageInput,
  type DeleteStageInput,
  type ReorderStagesInput,
  type UpdateStageInput
} from './schemas';

// Configurable stages (M2-05; PRD F-17, F-43). A CRM Lite surface: every function checks the `crm`
// module and the owner-or-admin permission before it reads or writes. Deals point at a stage by id,
// so renaming and reordering never moves a deal. Stage changes are audited (F-60).

/** A pipeline of more than this many columns stops fitting the board. */
export const MAX_STAGES = 20;

export type StageRow = Stage & { dealCount: number };

async function requireLite(ctx: TenantContextInput, opts: DealOpts) {
  if (!(await isModuleEnabled(ctx, 'crm', { level: 'lite', db: opts.db }))) {
    throw new AppError('MODULE_DISABLED');
  }
}

/** Pipelines are owner and admin settings (SECURITY 2.2, row "Branding, business profile, pipelines"). */
function requireWrite(actor: Actor, ctx: TenantContextInput) {
  if (!can(actor, 'settings.business', ctx.tenantId)) throw new AppError('FORBIDDEN');
}

const stagesOf = (tx: Tx, pipelineId: string) =>
  tx
    .select()
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipelineId))
    .orderBy(asc(pipelineStages.position), asc(pipelineStages.id));

/** Serialises concurrent edits of one pipeline so positions and names stay consistent. */
async function lockPipeline(tx: Tx, pipelineId?: string) {
  const pipeline = await loadPipeline(tx, pipelineId);
  await tx.execute(sql`select 1 from pipelines where id = ${pipeline.id} for update`);
  return pipeline;
}

async function loadStageOf(tx: Tx, stageId: string): Promise<Stage> {
  parseInput(uuidSchema, stageId);
  const [row] = await tx.select().from(pipelineStages).where(eq(pipelineStages.id, stageId));
  if (!row) throw notFound();
  return row;
}

function assertNameFree(existing: Stage[], name: string, exceptId?: string) {
  const taken = existing.some(
    (s) => s.id !== exceptId && s.name.toLowerCase() === name.toLowerCase()
  );
  if (taken) throw new ValidationError({ name: ['duplicate'] });
}

async function withCounts(tx: Tx, stages: Stage[]): Promise<StageRow[]> {
  const counts = await tx
    .select({ stageId: deals.stageId, n: sql<number>`count(*)::int` })
    .from(deals)
    .where(
      and(
        isNull(deals.deletedAt),
        inArray(
          deals.stageId,
          stages.map((s) => s.id)
        )
      )
    )
    .groupBy(deals.stageId);
  const byStage = new Map(counts.map((c) => [c.stageId, c.n]));
  return stages.map((s) => ({ ...s, dealCount: byStage.get(s.id) ?? 0 }));
}

/** The settings page's list: each stage in order with how many live deals sit in it. */
export async function listStagesWithCounts(
  ctx: TenantContextInput,
  pipelineId?: string,
  opts: DealOpts = {}
): Promise<StageRow[]> {
  await requireLite(ctx, opts);
  return run(ctx, opts, async (tx) => {
    const pipeline = await loadPipeline(tx, pipelineId);
    return withCounts(tx, await stagesOf(tx, pipeline.id));
  });
}

/**
 * Adds an open stage just before the first Won or Lost stage, so the outcome columns stay at the end
 * of the board. Reorder moves it from there.
 */
export async function createStage(
  ctx: TenantContextInput,
  actor: Actor,
  input: CreateStageInput,
  opts: DealOpts = {}
): Promise<StageRow[]> {
  await requireLite(ctx, opts);
  requireWrite(actor, ctx);
  const v = parseInput(createStageSchema, input);
  return run(ctx, opts, async (tx) => {
    const pipeline = await lockPipeline(tx, v.pipelineId);
    const existing = await stagesOf(tx, pipeline.id);
    if (existing.length >= MAX_STAGES) {
      throw new AppError('CONFLICT', {
        message: `A pipeline can have at most ${MAX_STAGES} stages.`
      });
    }
    assertNameFree(existing, v.name);
    const firstOutcome = existing.findIndex((s) => s.isWon || s.isLost);
    const at = firstOutcome === -1 ? existing.length : firstOutcome;
    const [created] = await tx
      .insert(pipelineStages)
      .values({
        tenantId: pipeline.tenantId,
        pipelineId: pipeline.id,
        name: v.name,
        position: at,
        probability: v.probability
      })
      .returning();
    for (const [i, s] of existing.entries()) {
      if (i >= at) {
        await tx
          .update(pipelineStages)
          .set({ position: i + 1 })
          .where(eq(pipelineStages.id, s.id));
      }
    }
    await audit(tx, {
      action: 'pipeline_stage.create',
      entity: 'pipeline_stage',
      entityId: created.id,
      after: { name: created.name, position: at, probability: created.probability }
    });
    return withCounts(tx, await stagesOf(tx, pipeline.id));
  });
}

/** Renames a stage or changes its win probability. The Won and Lost flags never change here. */
export async function updateStage(
  ctx: TenantContextInput,
  actor: Actor,
  stageId: string,
  patch: UpdateStageInput,
  opts: DealOpts = {}
): Promise<StageRow[]> {
  await requireLite(ctx, opts);
  requireWrite(actor, ctx);
  const v = parseInput(updateStageSchema, patch);
  return run(ctx, opts, async (tx) => {
    const stage = await loadStageOf(tx, stageId);
    const pipeline = await lockPipeline(tx, stage.pipelineId);
    const existing = await stagesOf(tx, pipeline.id);
    if (v.name !== undefined) assertNameFree(existing, v.name, stage.id);
    if (Object.keys(v).length > 0) {
      const [after] = await tx
        .update(pipelineStages)
        .set(v)
        .where(eq(pipelineStages.id, stage.id))
        .returning();
      const changed = (Object.keys(v) as (keyof typeof v)[]).filter((k) => stage[k] !== after[k]);
      if (changed.length > 0) {
        await audit(tx, {
          action: 'pipeline_stage.update',
          entity: 'pipeline_stage',
          entityId: stage.id,
          before: Object.fromEntries(changed.map((k) => [k, stage[k]])),
          after: Object.fromEntries(changed.map((k) => [k, after[k]]))
        });
      }
    }
    return withCounts(tx, await stagesOf(tx, pipeline.id));
  });
}

/** Sets the board order. `stageIds` must list every stage of the pipeline exactly once. */
export async function reorderStages(
  ctx: TenantContextInput,
  actor: Actor,
  input: ReorderStagesInput,
  opts: DealOpts = {}
): Promise<StageRow[]> {
  await requireLite(ctx, opts);
  requireWrite(actor, ctx);
  const v = parseInput(reorderStagesSchema, input);
  return run(ctx, opts, async (tx) => {
    const pipeline = await lockPipeline(tx, v.pipelineId);
    const existing = await stagesOf(tx, pipeline.id);
    const wanted = new Set(v.stageIds);
    const same =
      wanted.size === v.stageIds.length &&
      wanted.size === existing.length &&
      existing.every((s) => wanted.has(s.id));
    if (!same) throw new ValidationError({ stageIds: ['must_list_every_stage_once'] });
    const before = existing.map((s) => s.id);
    if (before.join() !== v.stageIds.join()) {
      for (const [position, id] of v.stageIds.entries()) {
        await tx.update(pipelineStages).set({ position }).where(eq(pipelineStages.id, id));
      }
      await audit(tx, {
        action: 'pipeline_stage.reorder',
        entity: 'pipeline',
        entityId: pipeline.id,
        before: { stageIds: before },
        after: { stageIds: v.stageIds }
      });
    }
    return withCounts(tx, await stagesOf(tx, pipeline.id));
  });
}

/**
 * Deletes an open stage. When deals still sit in it the caller must name another open stage of the
 * same pipeline and they move there in their current order (F-17). Won and Lost stages cannot be
 * deleted: reports and the lost-reason rule depend on them. Moving deals this way is a settings
 * change, not a customer step, so it emits no `deal.stage_changed` (DC-105).
 */
export async function deleteStage(
  ctx: TenantContextInput,
  actor: Actor,
  stageId: string,
  input: DeleteStageInput = {},
  opts: DealOpts = {}
): Promise<StageRow[]> {
  await requireLite(ctx, opts);
  requireWrite(actor, ctx);
  const v = parseInput(deleteStageSchema, input);
  return run(ctx, opts, async (tx) => {
    const stage = await loadStageOf(tx, stageId);
    if (stage.isWon || stage.isLost) {
      throw new AppError('CONFLICT', {
        message: 'The Won and Lost stages cannot be deleted. You can rename or move them.'
      });
    }
    const pipeline = await lockPipeline(tx, stage.pipelineId);
    // Soft-deleted deals still hold the stage by foreign key, so they move too.
    const inStage = await tx
      .select({ id: deals.id })
      .from(deals)
      .where(eq(deals.stageId, stage.id))
      .orderBy(asc(deals.position), asc(deals.id));
    let moved = 0;
    if (inStage.length > 0) {
      if (!v.moveToStageId) throw new ValidationError({ moveToStageId: ['required'] });
      const target = await loadStageOf(tx, v.moveToStageId).catch(() => {
        throw new ValidationError({ moveToStageId: ['not_found'] });
      });
      if (target.id === stage.id) throw new ValidationError({ moveToStageId: ['same_stage'] });
      if (target.pipelineId !== pipeline.id) {
        throw new ValidationError({ moveToStageId: ['wrong_pipeline'] });
      }
      if (target.isWon || target.isLost) {
        throw new ValidationError({ moveToStageId: ['must_be_open_stage'] });
      }
      const [last] = await tx
        .select({ position: deals.position })
        .from(deals)
        .where(eq(deals.stageId, target.id))
        .orderBy(sql`${deals.position} desc`)
        .limit(1);
      let position = last?.position ?? null;
      for (const d of inStage) {
        position = positionBetween(position, null);
        await tx
          .update(deals)
          .set({ stageId: target.id, position, updatedAt: sql`now()` as unknown as string })
          .where(eq(deals.id, d.id));
      }
      moved = inStage.length;
    }
    await tx.delete(pipelineStages).where(eq(pipelineStages.id, stage.id));
    const remaining = await stagesOf(tx, pipeline.id);
    for (const [position, s] of remaining.entries()) {
      if (s.position !== position) {
        await tx.update(pipelineStages).set({ position }).where(eq(pipelineStages.id, s.id));
      }
    }
    await audit(tx, {
      action: 'pipeline_stage.delete',
      entity: 'pipeline_stage',
      entityId: stage.id,
      before: { name: stage.name, position: stage.position },
      after: { movedDeals: moved, moveToStageId: v.moveToStageId ?? null }
    });
    return withCounts(tx, await stagesOf(tx, pipeline.id));
  });
}
