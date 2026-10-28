import { and, asc, desc, eq, gt, isNull, ne, sql } from 'drizzle-orm';
import { recordActivity } from '../activity';
import { audit } from '../audit';
import { contacts, dealContacts, deals, memberships, pipelineStages } from '../db/schema';
import { ValidationError } from '../errors';
import { emitEvent } from '../events';
import type { Tx } from '../db/client';
import type { TenantContextInput } from '../tenancy';
import { parseInput, uuidSchema } from '../validation';
import { positionBetween } from './position';
import { loadPipeline, notFound, run, type DealOpts, type Stage } from './pipelines';
import {
  createDealSchema,
  listDealsSchema,
  moveDealSchema,
  updateDealSchema,
  type CreateDealInput,
  type ListDealsInput,
  type MoveDealInput,
  type UpdateDealInput
} from './schemas';

// Deals service (M2-01; PRD F-14, F-16; DATABASE deals). Every function runs through withTenant,
// so RLS is the last line of tenant isolation and a read-only view-as session cannot write. Pass
// `tx` to join a caller's transaction (lead intake, imports), or `db` in tests. Events carry ids
// only (ARCHITECTURE section 6).

export type Deal = typeof deals.$inferSelect;

const actorOf = (ctx: TenantContextInput) => ({ type: 'user' as const, id: ctx.userId });
const now = () => sql`now()` as unknown as string;

async function assertOwner(tx: Tx, ownerId: string | null | undefined) {
  if (!ownerId) return;
  const [m] = await tx
    .select({ userId: memberships.userId })
    .from(memberships)
    .where(eq(memberships.userId, ownerId))
    .limit(1);
  if (!m) throw new ValidationError({ ownerId: ['not_a_member'] });
}

async function loadStage(tx: Tx, stageId: string): Promise<Stage> {
  const [s] = await tx.select().from(pipelineStages).where(eq(pipelineStages.id, stageId)).limit(1);
  if (!s) throw new ValidationError({ stageId: ['not_found'] });
  return s;
}

/** The column's last key, or the key after `afterDealId` (null = top), skipping the moving deal. */
async function nextPosition(
  tx: Tx,
  stageId: string,
  afterDealId: string | null | undefined,
  movingId?: string
): Promise<string> {
  const inColumn = and(
    eq(deals.stageId, stageId),
    isNull(deals.deletedAt),
    movingId ? ne(deals.id, movingId) : undefined
  );
  if (afterDealId === undefined) {
    const [last] = await tx
      .select({ position: deals.position })
      .from(deals)
      .where(inColumn)
      .orderBy(desc(deals.position))
      .limit(1);
    return positionBetween(last?.position ?? null, null);
  }
  let before: string | null = null;
  if (afterDealId !== null) {
    const [anchor] = await tx
      .select({ position: deals.position })
      .from(deals)
      .where(and(inColumn, eq(deals.id, afterDealId)))
      .limit(1);
    if (!anchor) throw new ValidationError({ afterDealId: ['not_in_stage'] });
    before = anchor.position;
  }
  const [next] = await tx
    .select({ position: deals.position })
    .from(deals)
    .where(and(inColumn, before === null ? undefined : gt(deals.position, before)))
    .orderBy(asc(deals.position))
    .limit(1);
  return positionBetween(before, next?.position ?? null);
}

/** Won and Lost stamps for a deal landing in `stage`; moving out of either clears it (undo). */
function outcomeFor(stage: Stage, lostReason: string | undefined) {
  if (stage.isLost && !lostReason) throw new ValidationError({ lostReason: ['required'] });
  return {
    wonAt: stage.isWon ? now() : null,
    lostAt: stage.isLost ? now() : null,
    lostReason: stage.isLost ? (lostReason as string) : null
  };
}

async function primaryContactId(tx: Tx, dealId: string): Promise<string | null> {
  const [row] = await tx
    .select({ contactId: dealContacts.contactId })
    .from(dealContacts)
    .where(eq(dealContacts.dealId, dealId))
    .orderBy(asc(dealContacts.createdAt))
    .limit(1);
  return row?.contactId ?? null;
}

async function emitOutcome(tx: Tx, ctx: TenantContextInput, deal: Deal, stage: Stage) {
  const base = { tenantId: deal.tenantId, actor: actorOf(ctx) };
  const contactId = await primaryContactId(tx, deal.id);
  if (stage.isWon) {
    await emitEvent(tx, {
      ...base,
      name: 'deal.won',
      payload: { dealId: deal.id, contactId, valueCents: deal.valueCents }
    });
  } else if (stage.isLost) {
    await emitEvent(tx, { ...base, name: 'deal.lost', payload: { dealId: deal.id, contactId } });
  }
}

export async function createDeal(
  ctx: TenantContextInput,
  input: CreateDealInput,
  opts: DealOpts = {}
): Promise<Deal> {
  const v = parseInput(createDealSchema, input);
  return run(ctx, opts, async (tx) => {
    const pipeline = await loadPipeline(tx, v.pipelineId);
    let stage: Stage;
    if (v.stageId) {
      stage = await loadStage(tx, v.stageId);
      if (stage.pipelineId !== pipeline.id)
        throw new ValidationError({ stageId: ['wrong_pipeline'] });
    } else {
      const [first] = await tx
        .select()
        .from(pipelineStages)
        .where(eq(pipelineStages.pipelineId, pipeline.id))
        .orderBy(asc(pipelineStages.position))
        .limit(1);
      if (!first) throw new ValidationError({ stageId: ['pipeline_has_no_stages'] });
      stage = first;
    }
    const outcome = outcomeFor(stage, v.lostReason);
    await assertOwner(tx, v.ownerId);
    if (v.contactId) {
      const [c] = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.id, v.contactId), isNull(contacts.deletedAt)))
        .limit(1);
      if (!c) throw new ValidationError({ contactId: ['not_found'] });
    }

    const [row] = await tx
      .insert(deals)
      .values({
        tenantId: sql`app_tenant_id()` as unknown as string,
        pipelineId: pipeline.id,
        stageId: stage.id,
        title: v.title,
        valueCents: v.valueCents,
        serviceType: v.serviceType ?? null,
        expectedClose: v.expectedClose ?? null,
        ownerId: v.ownerId ?? null,
        source: v.source ?? null,
        custom: v.custom,
        position: await nextPosition(tx, stage.id, undefined),
        ...outcome
      })
      .returning();
    if (v.contactId) {
      await tx.insert(dealContacts).values({
        tenantId: row.tenantId,
        dealId: row.id,
        contactId: v.contactId,
        role: 'homeowner'
      });
    }
    await audit(tx, {
      action: 'deal.create',
      entity: 'deal',
      entityId: row.id,
      after: { stageId: row.stageId, valueCents: row.valueCents, ownerId: row.ownerId }
    });
    await emitEvent(tx, {
      name: 'deal.created',
      tenantId: row.tenantId,
      actor: actorOf(ctx),
      payload: { dealId: row.id, stageId: row.stageId, contactId: v.contactId ?? null }
    });
    await emitOutcome(tx, ctx, row, stage);
    return row;
  });
}

export async function getDeal(
  ctx: TenantContextInput,
  id: string,
  opts: DealOpts & { includeDeleted?: boolean } = {}
): Promise<Deal> {
  parseInput(uuidSchema, id);
  return run(ctx, opts, async (tx) => {
    const [row] = await tx
      .select()
      .from(deals)
      .where(and(eq(deals.id, id), opts.includeDeleted ? undefined : isNull(deals.deletedAt)))
      .limit(1);
    if (!row) throw notFound();
    return row;
  });
}

export async function listDeals(
  ctx: TenantContextInput,
  input: ListDealsInput = {},
  opts: DealOpts = {}
): Promise<Deal[]> {
  const f = parseInput(listDealsSchema, input);
  return run(ctx, opts, (tx) =>
    tx
      .select()
      .from(deals)
      .where(
        and(
          isNull(deals.deletedAt),
          f.pipelineId ? eq(deals.pipelineId, f.pipelineId) : undefined,
          f.stageId ? eq(deals.stageId, f.stageId) : undefined,
          f.ownerId ? eq(deals.ownerId, f.ownerId) : undefined,
          f.source ? eq(deals.source, f.source) : undefined
        )
      )
      .orderBy(desc(deals.updatedAt), desc(deals.id))
      .limit(f.limit)
      .offset(f.offset)
  );
}

async function loadLive(tx: Tx, id: string): Promise<Deal> {
  parseInput(uuidSchema, id);
  const [row] = await tx
    .select()
    .from(deals)
    .where(and(eq(deals.id, id), isNull(deals.deletedAt)))
    .for('update')
    .limit(1);
  if (!row) throw notFound();
  return row;
}

/** Edits fields other than the stage. Moving between stages goes through `moveDeal`. */
export async function updateDeal(
  ctx: TenantContextInput,
  id: string,
  patch: UpdateDealInput,
  opts: DealOpts = {}
): Promise<Deal> {
  const v = parseInput(updateDealSchema, patch);
  return run(ctx, opts, async (tx) => {
    const before = await loadLive(tx, id);
    if (v.ownerId !== undefined) await assertOwner(tx, v.ownerId);
    const [after] = await tx
      .update(deals)
      .set({ ...v, updatedAt: now() })
      .where(eq(deals.id, id))
      .returning();
    const changed = (Object.keys(v) as (keyof typeof v)[]).filter(
      (k) => JSON.stringify(before[k]) !== JSON.stringify(after[k])
    );
    if (changed.length) {
      await audit(tx, {
        action: 'deal.update',
        entity: 'deal',
        entityId: id,
        before: Object.fromEntries(changed.map((k) => [k, before[k]])),
        after: Object.fromEntries(changed.map((k) => [k, after[k]]))
      });
    }
    return after;
  });
}

/**
 * Moves a deal to a stage of the same pipeline and/or to a place in the column (F-16). Entering a
 * Lost stage needs a reason (F-14); leaving Won or Lost clears its stamp, so undo restores the
 * previous state. Emits `deal.stage_changed` (plus `deal.won` or `deal.lost`) only when the stage
 * actually changes; a reorder inside one column writes the position alone.
 */
export async function moveDeal(
  ctx: TenantContextInput,
  id: string,
  input: MoveDealInput,
  opts: DealOpts = {}
): Promise<Deal> {
  const v = parseInput(moveDealSchema, input);
  return run(ctx, opts, async (tx) => {
    const before = await loadLive(tx, id);
    const to = await loadStage(tx, v.stageId);
    if (to.pipelineId !== before.pipelineId) {
      throw new ValidationError({ stageId: ['wrong_pipeline'] });
    }
    if (v.afterDealId === id) throw new ValidationError({ afterDealId: ['same_deal'] });
    const stageChanged = to.id !== before.stageId;
    const set: Partial<typeof deals.$inferInsert> = {
      position: await nextPosition(tx, to.id, v.afterDealId, id),
      updatedAt: now()
    };
    if (stageChanged) Object.assign(set, { stageId: to.id }, outcomeFor(to, v.lostReason));
    const [after] = await tx.update(deals).set(set).where(eq(deals.id, id)).returning();
    if (!stageChanged) return after;

    const from = await loadStage(tx, before.stageId);
    const contactId = await primaryContactId(tx, id);
    await audit(tx, {
      action: 'deal.move',
      entity: 'deal',
      entityId: id,
      before: { stageId: from.id },
      after: { stageId: to.id }
    });
    await recordActivity(tx, {
      contactId,
      dealId: id,
      type: 'stage_change',
      refTable: 'deals',
      refId: id,
      summary: `Moved from ${from.name} to ${to.name}`,
      actor: actorOf(ctx)
    });
    await emitEvent(tx, {
      name: 'deal.stage_changed',
      tenantId: after.tenantId,
      actor: actorOf(ctx),
      payload: { dealId: id, fromStageId: from.id, toStageId: to.id, contactId }
    });
    await emitOutcome(tx, ctx, after, to);
    return after;
  });
}

/** Soft delete: the row stays for history and reports but leaves the board and every list. */
export async function deleteDeal(
  ctx: TenantContextInput,
  id: string,
  opts: DealOpts = {}
): Promise<void> {
  await run(ctx, opts, async (tx) => {
    await loadLive(tx, id);
    await tx.update(deals).set({ deletedAt: now(), updatedAt: now() }).where(eq(deals.id, id));
    await audit(tx, { action: 'deal.delete', entity: 'deal', entityId: id });
  });
}

/** Undo a soft delete. The deal returns to the bottom of its column. */
export async function restoreDeal(
  ctx: TenantContextInput,
  id: string,
  opts: DealOpts = {}
): Promise<Deal> {
  parseInput(uuidSchema, id);
  return run(ctx, opts, async (tx) => {
    const [row] = await tx.select().from(deals).where(eq(deals.id, id)).for('update').limit(1);
    if (!row || !row.deletedAt) throw notFound();
    const [after] = await tx
      .update(deals)
      .set({
        deletedAt: null,
        updatedAt: now(),
        position: await nextPosition(tx, row.stageId, undefined, id)
      })
      .where(eq(deals.id, id))
      .returning();
    await audit(tx, { action: 'deal.restore', entity: 'deal', entityId: id });
    return after;
  });
}
