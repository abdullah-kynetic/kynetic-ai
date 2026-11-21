import { z } from 'zod';
import { listAdminTenantOverview } from '../admin/overview';
import {
  getAdminChecklist,
  markGoLive,
  updateChecklistStep,
  type StepPatch
} from '../admin/checklist';
import { onboardTenant } from '../admin/onboarding';
import {
  isLifecycleStage,
  moveClientLifecycle,
  LIFECYCLE_STAGES,
  type LifecycleStage
} from '../admin/client-lifecycle';
import { listAccountTemplates, saveAccountTemplate } from '../admin/account-templates';
import { applyIndustryTemplate } from '../admin/templates';
import { INDUSTRY_TEMPLATE_KEYS } from '../admin/industry-templates';
import { listTenantModuleConfig, setTenantAutomation } from '../admin/system-settings';
import { AppError } from '../errors';
import { parseInput, uuidSchema } from '../validation';
import { platformContext, type PlatformService } from '../service-auth/platform';

// Platform controls for the service API (E1). Owner's admin key only; these work across every client
// and take no client header. Each call goes through the portal's own functions, which check the role and
// write their own audit rows. Offboarding and tenant export are NOT exposed here yet: offboarding deletes
// client data and is held for a separate decision, and export needs a job-and-download design.

const idOnly = uuidSchema;
const lifecycleSchema = z.strictObject({ stage: z.enum(LIFECYCLE_STAGES) });
const moduleSchema = z.strictObject({
  templateKey: z.string().trim().min(1).max(80),
  enabled: z.boolean()
});
const applySchema = z.strictObject({ industry: z.enum(INDUSTRY_TEMPLATE_KEYS) });
const templateSchema = z.strictObject({
  sourceTenantId: uuidSchema,
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).optional()
});
const stepKeySchema = z.string().trim().min(1).max(80);

export async function listServicePlatformClients(plat: PlatformService) {
  return listAdminTenantOverview(platformContext(plat));
}

export async function getServicePlatformClient(plat: PlatformService, id: string) {
  parseInput(idOnly, id);
  const rows = await listAdminTenantOverview(platformContext(plat));
  const row = rows.find((r) => r.tenantId === id);
  if (!row) throw new AppError('NOT_FOUND');
  return row;
}

/** Onboards a client workspace with defaults. No owner invite is sent: that stays held (Tier B). */
export async function onboardServiceClient(plat: PlatformService, body: unknown) {
  return onboardTenant(platformContext(plat), body);
}

export async function getServiceClientChecklist(plat: PlatformService, id: string) {
  return getAdminChecklist(platformContext(plat), parseInput(idOnly, id));
}

export async function patchServiceClientChecklist(
  plat: PlatformService,
  id: string,
  body: unknown
) {
  parseInput(idOnly, id);
  const { key, ...patch } = (body ?? {}) as { key?: unknown } & Record<string, unknown>;
  const stepKey = parseInput(stepKeySchema, key);
  await updateChecklistStep(platformContext(plat), id, stepKey, patch as StepPatch);
  return { updated: true };
}

/** Marks go-live. Refused while required checklist items are open. */
export async function goLiveServiceClient(plat: PlatformService, id: string) {
  return markGoLive(platformContext(plat), parseInput(idOnly, id));
}

export async function setServiceClientLifecycle(plat: PlatformService, id: string, body: unknown) {
  parseInput(idOnly, id);
  const { stage } = parseInput(lifecycleSchema, body);
  if (!isLifecycleStage(stage)) throw new AppError('VALIDATION_FAILED');
  return moveClientLifecycle(platformContext(plat), id, stage as LifecycleStage);
}

export async function listServiceAccountTemplates(plat: PlatformService) {
  return listAccountTemplates({ id: plat.userId, kyneticRole: 'admin' });
}

export async function saveServiceAccountTemplate(plat: PlatformService, body: unknown) {
  const input = parseInput(templateSchema, body);
  return saveAccountTemplate({ id: plat.userId, kyneticRole: 'admin' }, input);
}

export async function applyServiceIndustryTemplate(
  plat: PlatformService,
  id: string,
  body: unknown
) {
  parseInput(idOnly, id);
  const { industry } = parseInput(applySchema, body);
  return applyIndustryTemplate(
    { id: plat.userId, kyneticRole: 'admin' },
    { tenantId: id, industry }
  );
}

export async function getServiceClientModules(plat: PlatformService, id: string) {
  return listTenantModuleConfig({ id: plat.userId, kyneticRole: 'admin' }, parseInput(idOnly, id));
}

/** Turns one automation template on or off for a client. Enabling is an ordinary portal change. */
export async function setServiceClientModule(plat: PlatformService, id: string, body: unknown) {
  parseInput(idOnly, id);
  const { templateKey, enabled } = parseInput(moduleSchema, body);
  return setTenantAutomation(
    { id: plat.userId, kyneticRole: 'admin' },
    { tenantId: id, templateKey, enabled }
  );
}
