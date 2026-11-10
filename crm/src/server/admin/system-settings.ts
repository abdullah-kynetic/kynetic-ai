import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { Actor } from '../auth/permissions';
import type { Db, Tx } from '../db/client';
import { automations, automationTemplates, tenantModules } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { setAutomationEnabled, type AutomationTemplateKey } from '../automations/service';
import { loadEnabledModules } from '../modules';
import {
  getTenantModules,
  setFollowupBundle,
  setTenantModule,
  type ModuleActor
} from '../modules/admin';
import { readableModuleConfig } from '../modules/catalog';
import { MODULE_KEYS, moduleSatisfied, type ModuleKey } from '../modules/keys';
import { withTenant, type TenantContextInput } from '../tenancy';

const templateKeys = [
  'speed_to_lead',
  'reactivation',
  'quote_followup',
  'appointment_reminders',
  'no_show_recovery',
  'missed_call_textback'
] as const satisfies readonly AutomationTemplateKey[];

export type TenantAutomationSetting = {
  key: AutomationTemplateKey;
  label: string;
  moduleKey: ModuleKey | null;
  enabled: boolean;
};

function requireAdmin(actor: ModuleActor) {
  if (actor.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
}

export async function listTenantAutomationSettings(
  actor: ModuleActor,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<TenantAutomationSetting[]> {
  requireAdmin(actor);
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  return withTenant(
    { tenantId, userId: actor.id, role: 'admin', readOnly: true },
    async (tx) => {
      const rows = await tx
        .select({
          key: automationTemplates.key,
          label: automationTemplates.label,
          moduleKey: automationTemplates.moduleKey,
          enabled: automations.enabled
        })
        .from(automationTemplates)
        .leftJoin(
          automations,
          and(
            eq(automations.templateKey, automationTemplates.key),
            eq(automations.kind, 'template')
          )
        )
        .orderBy(automationTemplates.key);
      return rows.flatMap((row) => {
        const key = z.enum(templateKeys).safeParse(row.key);
        const moduleKey = z.enum(MODULE_KEYS).safeParse(row.moduleKey);
        if (!key.success) return [];
        return [
          {
            key: key.data,
            label: row.label,
            moduleKey: moduleKey.success ? moduleKey.data : null,
            enabled: row.enabled ?? false
          }
        ];
      });
    },
    opts
  );
}

export async function listTenantModuleConfig(
  actor: ModuleActor,
  tenantId: string,
  opts: { db?: Db } = {}
) {
  requireAdmin(actor);
  const { tenant, modules } = await getTenantModules(actor, tenantId, opts);
  const configs = await withTenant(
    { tenantId, userId: actor.id, role: 'admin', readOnly: true },
    (tx) =>
      tx
        .select({ moduleKey: tenantModules.moduleKey, config: tenantModules.config })
        .from(tenantModules),
    opts
  );
  const byKey = new Map(configs.map((row) => [row.moduleKey, row.config]));
  return {
    tenant,
    modules: modules.map((module) => ({
      ...module,
      config: readableModuleConfig(byKey.get(module.moduleKey) ?? {})
    }))
  };
}

export async function setTenantAutomation(
  actor: ModuleActor,
  input: { tenantId: string; templateKey: string; enabled: boolean },
  opts: { db?: Db } = {}
): Promise<{ changed: boolean }> {
  requireAdmin(actor);
  const parsed = z
    .object({
      tenantId: z.uuid(),
      templateKey: z.enum(templateKeys),
      enabled: z.boolean()
    })
    .safeParse(input);
  if (!parsed.success) throw new ValidationError({ template: ['invalid'] });
  const ctx: TenantContextInput = {
    tenantId: parsed.data.tenantId,
    userId: actor.id,
    role: 'admin'
  };
  const adminActor: Actor = {
    userId: actor.id,
    kyneticRole: 'admin',
    membership: null,
    viewAs: null
  };
  return withTenant(
    ctx,
    async (tx) => {
      const current = await readAutomation(tx, parsed.data.templateKey);
      if (current === parsed.data.enabled) return { changed: false };
      const enabled = await loadEnabledModules(ctx, { tx });
      const templateModule = (
        await tx
          .select({ moduleKey: automationTemplates.moduleKey })
          .from(automationTemplates)
          .where(eq(automationTemplates.key, parsed.data.templateKey))
          .limit(1)
      )[0];
      const moduleKey = z.enum(MODULE_KEYS).safeParse(templateModule?.moduleKey);
      if (moduleKey.success && !moduleSatisfied(enabled, { module: moduleKey.data }))
        throw new AppError('MODULE_DISABLED');
      await setAutomationEnabled(
        ctx,
        adminActor,
        parsed.data.templateKey,
        parsed.data.enabled,
        enabled,
        {
          tx
        }
      );
      return { changed: true };
    },
    opts
  );
}

async function readAutomation(tx: Tx, key: AutomationTemplateKey): Promise<boolean> {
  const [row] = await tx
    .select({ enabled: automations.enabled })
    .from(automations)
    .where(and(eq(automations.templateKey, key), eq(automations.kind, 'template')))
    .limit(1);
  return row?.enabled ?? false;
}

export { setFollowupBundle, setTenantModule };
