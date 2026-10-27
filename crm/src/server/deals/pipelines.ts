import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import { deals, pipelines, pipelineStages } from '../db/schema';
import { AppError } from '../errors';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';
import { boardFiltersSchema, type BoardFilters } from './schemas';

// Pipelines and stages (M2-01; PRD F-16, F-17; DATABASE Pipelines and deals). One pipeline per
// tenant in v1 (F-18 is Later). Renaming and reordering stages is M2-05.

export type DealOpts = { db?: Db; tx?: Tx };
export type Pipeline = typeof pipelines.$inferSelect;
export type Stage = typeof pipelineStages.$inferSelect;

export function run<T>(ctx: TenantContextInput, opts: DealOpts, fn: (tx: Tx) => Promise<T>) {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

export const notFound = () => new AppError('NOT_FOUND');

/** F-17 default stages, in order: [name, win probability %, is_won, is_lost]. */
export const DEFAULT_STAGES = [
  ['New', 5, false, false],
  ['Contacted', 15, false, false],
  ['Qualified', 30, false, false],
  ['Estimate Booked', 45, false, false],
  ['Estimate Done', 60, false, false],
  ['Quoted', 70, false, false],
  ['Won', 100, true, false],
  ['Lost', 0, false, true]
] as const;

/**
 * Creates the tenant's default pipeline with the eight default stages (F-17). Safe to call twice:
 * a tenant that already has a default pipeline is left alone. Onboarding (F-55) calls it; the
 * caller's role must be allowed to write pipelines (owner, admin or system).
 */
export async function seedDefaultPipeline(
  ctx: TenantContextInput,
  opts: DealOpts = {}
): Promise<{ pipelineId: string; created: boolean }> {
  return run(ctx, opts, async (tx) => {
    const [existing] = await tx
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.isDefault, true))
      .limit(1);
    if (existing) return { pipelineId: existing.id, created: false };
    const [pipeline] = await tx
      .insert(pipelines)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        name: 'Sales',
        isDefault: true
      })
      .returning({ id: pipelines.id, tenantId: pipelines.tenantId });
    await tx.insert(pipelineStages).values(
      DEFAULT_STAGES.map(([name, probability, isWon, isLost], position) => ({
        tenantId: pipeline.tenantId,
        pipelineId: pipeline.id,
        name,
        position,
        probability,
        isWon,
        isLost
      }))
    );
    await audit(tx, {
      action: 'pipeline.seed_default',
      entity: 'pipeline',
      entityId: pipeline.id
    });
    return { pipelineId: pipeline.id, created: true };
  });
}

/** The tenant's default pipeline, or the given one. */
export async function getPipeline(
  ctx: TenantContextInput,
  pipelineId?: string,
  opts: DealOpts = {}
): Promise<Pipeline> {
  return run(ctx, opts, (tx) => loadPipeline(tx, pipelineId));
}

export async function loadPipeline(tx: Tx, pipelineId?: string): Promise<Pipeline> {
  const [row] = await tx
    .select()
    .from(pipelines)
    .where(pipelineId ? eq(pipelines.id, pipelineId) : eq(pipelines.isDefault, true))
    .limit(1);
  if (!row) throw notFound();
  return row;
}

export async function listStages(
  ctx: TenantContextInput,
  pipelineId?: string,
  opts: DealOpts = {}
): Promise<Stage[]> {
  return run(ctx, opts, async (tx) => {
    const p = await loadPipeline(tx, pipelineId);
    return tx
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, p.id))
      .orderBy(asc(pipelineStages.position));
  });
}

export type BoardDeal = Pick<
  typeof deals.$inferSelect,
  | 'id'
  | 'title'
  | 'valueCents'
  | 'serviceType'
  | 'expectedClose'
  | 'ownerId'
  | 'source'
  | 'stageId'
  | 'position'
  | 'createdAt'
>;
export type BoardColumn = { stage: Stage; count: number; totalCents: number; deals: BoardDeal[] };
export type Board = { pipeline: Pipeline; columns: BoardColumn[] };

/**
 * Everything the kanban page needs (F-16): each stage in order with its live deals in position
 * order, a count and a dollar total. Filters narrow the deals, and the counts and totals follow.
 */
export async function getBoard(
  ctx: TenantContextInput,
  filters: BoardFilters = {},
  opts: DealOpts = {}
): Promise<Board> {
  const f = parseInput(boardFiltersSchema, filters);
  return run(ctx, opts, async (tx) => {
    const pipeline = await loadPipeline(tx, f.pipelineId);
    const stages = await tx
      .select()
      .from(pipelineStages)
      .where(eq(pipelineStages.pipelineId, pipeline.id))
      .orderBy(asc(pipelineStages.position));
    const rows = await tx
      .select({
        id: deals.id,
        title: deals.title,
        valueCents: deals.valueCents,
        serviceType: deals.serviceType,
        expectedClose: deals.expectedClose,
        ownerId: deals.ownerId,
        source: deals.source,
        stageId: deals.stageId,
        position: deals.position,
        createdAt: deals.createdAt
      })
      .from(deals)
      .where(
        and(
          eq(deals.pipelineId, pipeline.id),
          isNull(deals.deletedAt),
          f.ownerId ? eq(deals.ownerId, f.ownerId) : undefined,
          f.source ? eq(deals.source, f.source) : undefined
        )
      )
      .orderBy(asc(deals.position), asc(deals.id));
    return {
      pipeline,
      columns: stages.map((stage) => {
        const inStage = rows.filter((d) => d.stageId === stage.id);
        return {
          stage,
          count: inStage.length,
          totalCents: inStage.reduce((sum, d) => sum + d.valueCents, 0),
          deals: inStage
        };
      })
    };
  });
}
