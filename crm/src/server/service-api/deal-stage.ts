import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { deals, pipelineStages } from '../db/schema';
import { moveDeal } from '../deals/service';
import { AppError } from '../errors';
import type { ServiceContext } from '../service-auth/authenticate';
import { plainNote } from './call-log';
import { getDealDto } from './reads';

// POST /api/service/deals/{id}/stage. Moves one deal to a stage of its own pipeline. Events it emits are
// tagged origin: 'service-api' so the n8n push, the quote follow-up and the won alert skip them.
// The lost reason is untrusted text: it is reduced to plain text and must be read as data.

export const serviceDealStageSchema = z.strictObject({
  stageId: z.uuid(),
  lostReason: z.string().max(500).optional()
});

export type ServiceDealStageInput = z.output<typeof serviceDealStageSchema>;

/** Runs inside withServiceTenant. A deal or stage of another tenant or pipeline is a 404 with nothing written. */
export async function moveServiceDeal(
  tx: Tx,
  svc: ServiceContext,
  dealId: string,
  input: ServiceDealStageInput
) {
  const [deal] = await tx
    .select({ stageId: deals.stageId, pipelineId: deals.pipelineId })
    .from(deals)
    .where(eq(deals.id, dealId))
    .limit(1);
  if (!deal) throw new AppError('NOT_FOUND');
  const [stage] = await tx
    .select({ pipelineId: pipelineStages.pipelineId })
    .from(pipelineStages)
    .where(eq(pipelineStages.id, input.stageId))
    .limit(1);
  if (!stage || stage.pipelineId !== deal.pipelineId) throw new AppError('NOT_FOUND');
  const lostReason = input.lostReason ? plainNote(input.lostReason) : undefined;
  await moveDeal(
    { tenantId: svc.tenantId, role: 'system' },
    dealId,
    { stageId: input.stageId, lostReason: lostReason || undefined },
    { tx, origin: 'service-api' }
  );
  const data = await getDealDto(tx, dealId);
  return {
    fromStageId: deal.stageId,
    toStageId: input.stageId,
    changed: deal.stageId !== input.stageId,
    deal: data
  };
}
