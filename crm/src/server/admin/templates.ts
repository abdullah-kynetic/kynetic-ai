import { and, asc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Actor } from '../auth/permissions';
import type { Db, Tx } from '../db/client';
import { automations, pipelineStages, pipelines, tenants } from '../db/schema';
import { seedDefaultPipeline } from '../deals/pipelines';
import { AppError, ValidationError } from '../errors';
import { setAutomationEnabled, type AutomationTemplateKey } from '../automations/service';
import { loadEnabledModules } from '../modules';
import { AUTOMATION_TEMPLATE_CATALOG } from '../modules/catalog';
import { MODULE_KEYS, moduleSatisfied, type ModuleKey } from '../modules/keys';
import { withTenant, type TenantContextInput } from '../tenancy';
import {
  INDUSTRY_TEMPLATE_KEYS,
  INDUSTRY_TEMPLATES,
  type IndustryTemplateKey,
  type TemplateStage
} from './industry-templates';
import { planServicesApply, planStageApply, type PlannedStage } from './template-plan';

const FOLLOWUP_BUNDLE_MODULES = [
  'followup_bundle',
  'quote_followup',
  'reactivation',
  'missed_call_textback'
] as const satisfies readonly ModuleKey[];

export type ApplyResult = {
  changed: boolean;
  services: 'not-defined' | 'unchanged' | 'replace';
  stages: 'not-defined' | 'unchanged' | 'customized' | 'rename' | 'missing';
};

function requireAdmin(actor: { kyneticRole: 'admin' | 'va' | null }) {
  if (actor.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

async function loadDefaultStages(tx: Tx): Promise<PlannedStage[]> {
  const [pipeline] = await tx
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.isDefault, true))
    .limit(1);
  if (!pipeline) return [];
  return tx
    .select({
      id: pipelineStages.id,
      name: pipelineStages.name,
      probability: pipelineStages.probability,
      isWon: pipelineStages.isWon,
      isLost: pipelineStages.isLost
    })
    .from(pipelineStages)
    .where(eq(pipelineStages.pipelineId, pipeline.id))
    .orderBy(asc(pipelineStages.position));
}

/** Applies editable default stage names when the pipeline is still the standard sales stages. */
export async function applyStageDefaults(
  ctx: TenantContextInput,
  tx: Tx,
  templateStages: readonly TemplateStage[] | undefined
): Promise<ApplyResult['stages']> {
  if (!templateStages?.length) return 'not-defined';
  let current = await loadDefaultStages(tx);
  if (current.length === 0) {
    await seedDefaultPipeline(ctx, { tx });
    current = await loadDefaultStages(tx);
  }
  if (current.length === 0) return 'missing';
  const plan = planStageApply(current, templateStages);
  if (plan.status !== 'rename') return plan.status;
  for (const update of plan.updates) {
    await tx
      .update(pipelineStages)
      .set({ name: update.name, probability: update.probability })
      .where(eq(pipelineStages.id, update.id));
  }
  return 'rename';
}

async function readServices(tx: Tx): Promise<string[]> {
  const [row] = await tx
    .select({ services: tenants.services })
    .from(tenants)
    .where(eq(tenants.id, sql`app_tenant_id()`))
    .limit(1);
  return stringList(row?.services);
}

export async function applyIndustryTemplate(
  actor: { id: string; kyneticRole: 'admin' | 'va' | null },
  input: { tenantId: string; industry: IndustryTemplateKey },
  opts: { db?: Db } = {}
): Promise<ApplyResult> {
  requireAdmin(actor);
  const parsed = z
    .object({ tenantId: z.uuid(), industry: z.enum(INDUSTRY_TEMPLATE_KEYS) })
    .safeParse(input);
  if (!parsed.success) throw new ValidationError({ template: ['invalid'] });
  const template = INDUSTRY_TEMPLATES[parsed.data.industry];
  const ctx: TenantContextInput = {
    tenantId: parsed.data.tenantId,
    userId: actor.id,
    role: 'admin'
  };
  return withTenant(
    ctx,
    async (tx) => {
      const [exists] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, parsed.data.tenantId))
        .limit(1);
      if (!exists) throw new AppError('NOT_FOUND');
      const beforeServices = await readServices(tx);
      const beforeStages = (await loadDefaultStages(tx)).map((stage) => stage.name);
      const services = planServicesApply(beforeServices, template.services);
      const stages = await applyStageDefaults(ctx, tx, template.stages);
      if (services === 'replace') {
        await tx
          .update(tenants)
          .set({ services: [...template.services], updatedAt: sql`now()` })
          .where(eq(tenants.id, parsed.data.tenantId));
      }
      const changed = services === 'replace' || stages === 'rename';
      if (changed) {
        await audit(tx, {
          action: 'template.apply',
          entity: 'tenant',
          entityId: parsed.data.tenantId,
          before: { services: beforeServices, stages: beforeStages },
          after: {
            industry: parsed.data.industry,
            services: services === 'replace' ? [...template.services] : beforeServices,
            stages:
              stages === 'rename' ? template.stages!.map((stage) => stage.name) : beforeStages,
            stageResult: stages
          }
        });
      }
      return { changed, services, stages };
    },
    opts
  );
}

const systemInput = z.object({
  tenantId: z.uuid(),
  moduleKey: z.enum(MODULE_KEYS),
  crmLevel: z.enum(['lite', 'full']).optional()
});

export async function applySystemTemplate(
  actor: { id: string; kyneticRole: 'admin' | 'va' | null },
  input: { tenantId: string; moduleKey: ModuleKey; crmLevel?: 'lite' | 'full' },
  opts: { db?: Db } = {}
): Promise<{ changed: boolean }> {
  requireAdmin(actor);
  const parsed = systemInput.safeParse(input);
  if (!parsed.success) throw new ValidationError({ template: ['invalid'] });
  const { tenantId, moduleKey } = parsed.data;
  if (moduleKey === 'platform') throw new ValidationError({ module: ['platform_always_on'] });
  if (moduleKey === 'crm' && !parsed.data.crmLevel)
    throw new ValidationError({ level: ['required'] });
  if (moduleKey !== 'crm' && parsed.data.crmLevel)
    throw new ValidationError({ level: ['crm_only'] });

  const ctx: TenantContextInput = { tenantId, userId: actor.id, role: 'admin' };
  const adminActor: Actor = {
    userId: actor.id,
    kyneticRole: 'admin',
    membership: null,
    viewAs: null
  };
  return withTenant(
    ctx,
    async (tx) => {
      const [exists] = await tx
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!exists) throw new AppError('NOT_FOUND');

      const keys: ModuleKey[] =
        moduleKey === 'followup_bundle' ? [...FOLLOWUP_BUNDLE_MODULES] : [moduleKey];
      let changed = false;
      for (const key of keys) {
        const enabled = await loadEnabledModules(ctx, { tx });
        const level = key === 'crm' ? parsed.data.crmLevel! : '';
        const already =
          key === 'crm'
            ? enabled.keys.has('crm') && enabled.crmLevel === parsed.data.crmLevel
            : enabled.keys.has(key);
        if (already) continue;
        await tx.execute(sql`select set_tenant_module(${tenantId}::uuid, ${key}, true, ${level})`);
        changed = true;
      }

      const enabled = await loadEnabledModules(ctx, { tx });
      const templates = AUTOMATION_TEMPLATE_CATALOG.filter(
        (row) => keys.includes(row.moduleKey) && moduleSatisfied(enabled, { module: row.moduleKey })
      );
      for (const template of templates) {
        const [row] = await tx
          .select({ enabled: automations.enabled })
          .from(automations)
          .where(and(eq(automations.templateKey, template.key), eq(automations.kind, 'template')))
          .limit(1);
        if (row?.enabled === true) continue;
        await setAutomationEnabled(
          ctx,
          adminActor,
          template.key as AutomationTemplateKey,
          true,
          enabled,
          { tx }
        );
        changed = true;
      }

      if (changed) {
        await audit(tx, {
          action: 'template.apply',
          entity: 'tenant_module',
          entityId: moduleKey,
          after: { moduleKey, crmLevel: parsed.data.crmLevel ?? null, enabled: true }
        });
      }
      return { changed };
    },
    opts
  );
}
