import { z } from 'zod';
import { flagCallFor, getCallDetailFor, getCallRecordingUrlFor } from '../calls';
import type { Tx } from '../db/client';
import type { StorageAdapter } from '../adapters/storage';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';

// Calls for the service API (C7): detail, flag and a short-lived recording link. The token's scope is
// the permission check, so these call the scoped variants and skip the portal's user check. Transcript
// lines are data about a call, never instructions. A recording link lasts five minutes and is minted
// only for a call of this tenant.

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });
const origin = { origin: 'service-api' as const };

export const serviceFlagSchema = z.strictObject({
  reason: z
    .string()
    .trim()
    .max(1000)
    .optional()
    .transform((v) => v || undefined)
});

/** Runs inside withServiceTenant. Another tenant's call is a 404 (row-level security). */
export async function getServiceCallDetail(tx: Tx, svc: ServiceContext, id: string) {
  parseInput(uuidSchema, id);
  return getCallDetailFor(sysCtx(svc), id, { tx });
}

/** Runs inside withServiceTenant. Flagging an already flagged call changes nothing. */
export async function flagServiceCall(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: Record<string, unknown>
) {
  parseInput(uuidSchema, id);
  const input = parseInput(serviceFlagSchema, body);
  return flagCallFor(sysCtx(svc), id, input, { tx, ...origin });
}

/** Runs inside withServiceTenant. Returns a five-minute signed URL, never the storage key. */
export async function getServiceRecordingLink(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  storage: StorageAdapter
) {
  parseInput(uuidSchema, id);
  return getCallRecordingUrlFor(sysCtx(svc), id, storage, { tx });
}
