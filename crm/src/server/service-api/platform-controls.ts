import { z } from 'zod';
import {
  listUsageMonth,
  readOutboundPause,
  setClientEmailFlags,
  setLlmMonthlyCap,
  setMonthlySpendCap,
  setOutboundPaused
} from '../admin/platform-controls';
import {
  listFailedWebhooks,
  listFlaggedCalls,
  listIntegrationHealth,
  listRecentJobs,
  markFlaggedCallReviewed,
  replayFailedWebhook
} from '../admin/operations';
import { suspendTenant } from '../admin/operations-tools';
import { AppError } from '../errors';
import { parseInput, uuidSchema } from '../validation';
import { platformContext, type PlatformService } from '../service-auth/platform';

// Safety controls for the service API (E3). Owner's admin key only. The API may pause outbound, lower a
// spend or LLM cap, suspend a client, replay a failed webhook and mark a flagged call reviewed. It may NOT
// turn outbound back on, raise or remove a cap, turn email flags on, or reinstate a suspended client: those
// wait for Abdullah's rule. Everything goes through the portal's own functions.

const pauseSchema = z.strictObject({
  paused: z.boolean(),
  reason: z.string().trim().min(1).max(300).optional()
});
const capSchema = z.strictObject({ cents: z.number().int().min(0).max(100_000_000).nullable() });
const flagsSchema = z.strictObject({ weekly: z.boolean(), report: z.boolean() });
const reviewSchema = z.strictObject({ tenantId: uuidSchema });

const refuse = (message: string) => new AppError('FORBIDDEN', { message });

export async function getServiceOutboundPause(plat: PlatformService) {
  return readOutboundPause(platformContext(plat));
}

/** Pausing is always allowed. Turning outbound back on is refused: it needs Abdullah's rule. */
export async function setServiceOutboundPause(plat: PlatformService, body: unknown) {
  const { paused, reason } = parseInput(pauseSchema, body);
  if (!paused) throw refuse('Turning outbound back on is not available through the API.');
  await setOutboundPaused(platformContext(plat), true, reason ?? 'Paused through the service API.');
  return readOutboundPause(platformContext(plat));
}

async function currentCap(plat: PlatformService, id: string, field: 'capCents' | 'llmCapCents') {
  const usage = await listUsageMonth(platformContext(plat), undefined);
  const row = usage.rows.find((r) => r.tenantId === id);
  return row ? (row[field] ?? null) : null;
}

/** Lowers a monthly spend cap. Raising it, or removing it, is refused. */
async function lowerCap(
  plat: PlatformService,
  id: string,
  body: unknown,
  field: 'capCents' | 'llmCapCents'
) {
  parseInput(uuidSchema, id);
  const { cents } = parseInput(capSchema, body);
  if (cents === null) throw refuse('Removing a cap is not available through the API.');
  const current = await currentCap(plat, id, field);
  if (current !== null && cents >= current)
    throw refuse('The API can only lower a cap. Raising it needs Abdullah.');
  return field === 'capCents'
    ? setMonthlySpendCap(platformContext(plat), id, cents)
    : setLlmMonthlyCap(platformContext(plat), id, cents);
}

export async function setServiceSpendCap(plat: PlatformService, id: string, body: unknown) {
  await lowerCap(plat, id, body, 'capCents');
  return { updated: true };
}

export async function setServiceLlmCap(plat: PlatformService, id: string, body: unknown) {
  await lowerCap(plat, id, body, 'llmCapCents');
  return { updated: true };
}

/** Email flags can only be switched off through the API. Switching them on needs Abdullah. */
export async function setServiceEmailFlags(plat: PlatformService, id: string, body: unknown) {
  parseInput(uuidSchema, id);
  const flags = parseInput(flagsSchema, body);
  if (flags.weekly || flags.report)
    throw refuse('Turning email on is not available through the API.');
  await setClientEmailFlags(platformContext(plat), id, flags);
  return { updated: true };
}

export async function suspendServiceClient(plat: PlatformService, id: string) {
  parseInput(uuidSchema, id);
  await suspendTenant(platformContext(plat), id, true);
  return { suspended: true };
}

export async function listServiceFailedWebhooks(plat: PlatformService) {
  return listFailedWebhooks(platformContext(plat));
}

export async function replayServiceWebhook(plat: PlatformService, id: string) {
  parseInput(uuidSchema, id);
  return replayFailedWebhook(platformContext(plat), id);
}

export async function listServiceJobs(plat: PlatformService) {
  return listRecentJobs(platformContext(plat));
}

export async function getServiceIntegrationHealth(plat: PlatformService) {
  return listIntegrationHealth(platformContext(plat));
}

export async function listServiceFlaggedCalls(plat: PlatformService) {
  return listFlaggedCalls(platformContext(plat));
}

export async function reviewServiceFlaggedCall(plat: PlatformService, id: string, body: unknown) {
  parseInput(uuidSchema, id);
  const { tenantId } = parseInput(reviewSchema, body);
  const ok = await markFlaggedCallReviewed(platformContext(plat), { tenantId, callId: id });
  return { reviewed: ok };
}
