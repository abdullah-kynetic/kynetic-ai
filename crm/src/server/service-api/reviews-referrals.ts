import type { Tx } from '../db/client';
import { AppError, ValidationError } from '../errors';
import {
  createReferral,
  listReferrals,
  resolveReferralStatus,
  updateReferral,
  type CreateReferralInput,
  type UpdateReferralInput
} from '../referrals';
import { resolveReviewTrendRange, reviewSummary } from '../reviews';
import type { ServiceContext } from '../service-auth/authenticate';
import { parseInput, uuidSchema } from '../validation';

// Reviews summary, referrals list, create and edit for the service API (C9). The token scope is the
// permission check, so these pass a system context and skip the portal's user checks. Reward fields
// (`rewardCents`, `rewardStatus`) stay owner-only in the portal, and the system context is not the
// owner, so the API refuses them with FORBIDDEN. Presence and review requests are not in this step.

const sysCtx = (svc: ServiceContext) => ({ tenantId: svc.tenantId, role: 'system' as const });

/** Runs inside withServiceTenant. `range` is '90d' or '12m'; anything else is a validation error. */
export async function getServiceReviewSummary(tx: Tx, svc: ServiceContext, rawRange?: string) {
  const range = resolveReviewTrendRange(rawRange);
  if (rawRange !== undefined && range !== rawRange) {
    throw new ValidationError({ range: ['must be 90d or 12m'] });
  }
  return reviewSummary(sysCtx(svc), { tx, range });
}

/** Runs inside withServiceTenant. An unknown status filter is a validation error, not an empty list. */
export async function listServiceReferrals(tx: Tx, svc: ServiceContext, rawStatus?: string) {
  let status: ReturnType<typeof resolveReferralStatus>;
  if (rawStatus !== undefined) {
    status = resolveReferralStatus(rawStatus);
    if (!status) throw new ValidationError({ status: ['unknown status'] });
  }
  return listReferrals(sysCtx(svc), status ? { status } : {}, { tx });
}

/** Runs inside withServiceTenant. Returns the new referral id and the linked referee contact id. */
export async function createServiceReferral(
  tx: Tx,
  svc: ServiceContext,
  body: Record<string, unknown>
) {
  return createReferral(sysCtx(svc), body as CreateReferralInput, { tx });
}

/** Runs inside withServiceTenant. Edits the fields sent; reward fields are refused (see top). */
export async function updateServiceReferral(
  tx: Tx,
  svc: ServiceContext,
  id: string,
  body: Record<string, unknown>
) {
  parseInput(uuidSchema, id);
  if ('rewardCents' in body || 'rewardStatus' in body) throw new AppError('FORBIDDEN');
  await updateReferral(sysCtx(svc), id, body as UpdateReferralInput, { tx });
  return { id, updated: true as const };
}
