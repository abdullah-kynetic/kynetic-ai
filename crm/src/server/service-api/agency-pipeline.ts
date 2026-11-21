import { eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Tx } from '../db/client';
import { agencyContracts } from '../db/schema';
import { AppError } from '../errors';
import { getAgencyPipeline, moveAgencyDeal, renameAgencyStage } from '../agency';
import {
  createAgencyContract,
  getAgencyContractFileUrl,
  listAgencyContracts,
  markAgencyContractSent,
  markAgencyContractSigned,
  voidAgencyContract
} from '../agency/contracts';
import { parseInput, uuidSchema } from '../validation';
import type { ServiceContext } from '../service-auth/authenticate';
import { requireAgency } from './agency';

// Pipeline, proposals and contracts for the agency workspace (D2). Admin key only. Marking a contract
// sent only records it: the API never emails a contract. Signed contracts cannot be voided (the
// portal refuses with CONFLICT).

const moveSchema = z.strictObject({
  stageId: z.uuid(),
  lostReason: z.string().trim().max(200).optional()
});
const renameSchema = z.strictObject({ name: z.string().trim().min(1).max(60) });

export async function getServiceAgencyPipeline(tx: Tx, svc: ServiceContext) {
  return getAgencyPipeline(await requireAgency(tx, svc));
}

export async function moveServiceAgencyDeal(
  tx: Tx,
  svc: ServiceContext,
  dealId: string,
  body: unknown
) {
  parseInput(uuidSchema, dealId);
  const input = parseInput(moveSchema, body);
  const options = input.lostReason ? { lostReason: input.lostReason } : {};
  return moveAgencyDeal(await requireAgency(tx, svc), dealId, input.stageId, options);
}

export async function renameServiceAgencyStage(
  tx: Tx,
  svc: ServiceContext,
  stageId: string,
  body: unknown
) {
  parseInput(uuidSchema, stageId);
  const input = parseInput(renameSchema, body);
  return renameAgencyStage(await requireAgency(tx, svc), stageId, input.name);
}

export async function listServiceAgencyContracts(
  tx: Tx,
  svc: ServiceContext,
  filter: { status?: string; stageId?: string }
) {
  return listAgencyContracts(await requireAgency(tx, svc), filter);
}

export async function createServiceAgencyContract(tx: Tx, svc: ServiceContext, body: unknown) {
  return createAgencyContract(await requireAgency(tx, svc), body);
}

export async function markServiceContractSent(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: unknown
) {
  parseInput(uuidSchema, id);
  return markAgencyContractSent(await requireAgency(tx, svc), { ...(body as object), id });
}

export async function markServiceContractSigned(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: unknown
) {
  parseInput(uuidSchema, id);
  return markAgencyContractSigned(await requireAgency(tx, svc), { ...(body as object), id }, null);
}

/** A signed contract cannot be voided through the API, whatever the portal would allow. */
export async function voidServiceContract(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  const caller = await requireAgency(tx, svc);
  const [row] = await tx
    .select({ status: agencyContracts.status })
    .from(agencyContracts)
    .where(eq(agencyContracts.id, id))
    .limit(1);
  if (row?.status === 'signed') throw new AppError('CONFLICT');
  return voidAgencyContract(caller, id);
}

export async function getServiceContractFile(tx: Tx, svc: ServiceContext, id: string) {
  return getAgencyContractFileUrl(await requireAgency(tx, svc), id);
}
