import type { Actor } from '../auth';
import type { Tx } from '../db/client';
import {
  createStage,
  deleteStage,
  listStagesWithCounts,
  reorderStages,
  updateStage
} from '../deals/stages';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';
import { createStageSchema, reorderStagesSchema, updateStageSchema } from '../deals/schemas';

// Pipeline stage settings for the service API (C4). Scope pipeline:write is the permission check. The
// stage functions skip their portal actor check only when origin is 'service-api', which only this file
// sets. The 20-stage cap (MAX_STAGES) is enforced by createStage itself.

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });
const origin = { origin: 'service-api' as const };
// The stage functions take an actor for the portal's permission check, which is skipped here. Never read.
const serviceActor = { userId: 'service-api' } as unknown as Actor;

/** Runs inside withServiceTenant. */
export async function listServiceStages(tx: Tx, svc: ServiceContext, pipelineId: string) {
  parseInput(uuidSchema, pipelineId);
  return listStagesWithCounts(sysCtx(svc), pipelineId, { tx });
}

/** Runs inside withServiceTenant. */
export async function createServiceStage(
  tx: Tx,
  svc: ServiceContext,
  pipelineId: string,
  body: Record<string, unknown>
) {
  parseInput(uuidSchema, pipelineId);
  const input = parseInput(createStageSchema, { ...body, pipelineId });
  return createStage(sysCtx(svc), serviceActor, input, { tx, ...origin });
}

/** Runs inside withServiceTenant. */
export async function updateServiceStage(
  tx: Tx,
  svc: ServiceContext,
  stageId: string,
  body: Record<string, unknown>
) {
  parseInput(uuidSchema, stageId);
  const patch = parseInput(updateStageSchema, body);
  return updateStage(sysCtx(svc), serviceActor, stageId, patch, { tx, ...origin });
}

/** Runs inside withServiceTenant. Refused while deals remain on the stage. */
export async function deleteServiceStage(tx: Tx, svc: ServiceContext, stageId: string) {
  parseInput(uuidSchema, stageId);
  await deleteStage(sysCtx(svc), serviceActor, stageId, {}, { tx, ...origin });
  return { id: stageId, deleted: true as const };
}

/** Runs inside withServiceTenant. The whole order changes or none of it does. */
export async function reorderServiceStages(
  tx: Tx,
  svc: ServiceContext,
  pipelineId: string,
  body: Record<string, unknown>
) {
  parseInput(uuidSchema, pipelineId);
  const input = parseInput(reorderStagesSchema, { ...body, pipelineId });
  return reorderStages(sysCtx(svc), serviceActor, input, { tx, ...origin });
}
