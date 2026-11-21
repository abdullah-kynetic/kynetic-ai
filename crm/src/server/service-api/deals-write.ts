import type { Tx } from '../db/client';
import { createDeal, deleteDeal, restoreDeal, updateDeal } from '../deals/service';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';
import { getDealDto } from './reads';

// Deal create, edit, delete and restore for the service API (C4). Each is the same function the portal
// uses, with origin 'service-api', so the n8n push, the quote follow-up and the won alert skip it.
// Moving a deal between stages is POST /deals/{id}/stage (already built in C-stage).

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });
const origin = { origin: 'service-api' as const };

/** Runs inside withServiceTenant. */
export async function createServiceDeal(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>
) {
  const deal = await createDeal(sysCtx(svc), body as never, { tx, ...origin });
  return getDealDto(tx, deal.id);
}

/** Runs inside withServiceTenant. Only the fields sent change. */
export async function updateServiceDeal(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: Record<string, unknown>
) {
  parseInput(uuidSchema, id);
  await updateDeal(sysCtx(svc), id, body as never, { tx, ...origin });
  return getDealDto(tx, id);
}

/** Runs inside withServiceTenant. Soft delete. */
export async function deleteServiceDeal(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  await deleteDeal(sysCtx(svc), id, { tx, ...origin });
  return { id, deleted: true as const };
}

/** Runs inside withServiceTenant. Undo a soft delete. */
export async function restoreServiceDeal(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  await restoreDeal(sysCtx(svc), id, { tx, ...origin });
  return getDealDto(tx, id);
}
