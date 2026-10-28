import { and, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import type { Db, Tx } from '../db/client';
import { audit } from '../audit';
import { automations, automationRuns, automationTemplates } from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { moduleSatisfied, type EnabledModules } from '../modules/keys';
import { withTenant, type TenantContextInput } from '../tenancy';
import { can, type Actor } from '../auth/permissions';

const templateKeySchema = z.enum([
  'speed_to_lead',
  'reactivation',
  'quote_followup',
  'appointment_reminders',
  'no_show_recovery',
  'missed_call_textback'
]);
export type AutomationTemplateKey = z.infer<typeof templateKeySchema>;

function requireToggle(actor: Actor, tenantId: string) {
  if (!can(actor, 'automations.toggle', tenantId)) throw new AppError('FORBIDDEN');
}

export async function listAutomationTemplates(
  ctx: TenantContextInput,
  opts: { db?: Db; tx?: Tx } = {}
) {
  const run = (tx: Tx) =>
    tx
      .select({
        key: automationTemplates.key,
        label: automationTemplates.label,
        moduleKey: automationTemplates.moduleKey,
        automation: automations
      })
      .from(automationTemplates)
      .leftJoin(
        automations,
        and(eq(automations.templateKey, automationTemplates.key), eq(automations.kind, 'template'))
      )
      .orderBy(automationTemplates.key);
  return opts.tx ? run(opts.tx) : withTenant(ctx, run, { db: opts.db });
}

export async function setAutomationEnabled(
  ctx: TenantContextInput,
  actor: Actor,
  key: AutomationTemplateKey,
  enabled: boolean,
  modules: EnabledModules,
  opts: { db?: Db; tx?: Tx } = {}
) {
  requireToggle(actor, ctx.tenantId);
  const parsedKey = templateKeySchema.safeParse(key);
  if (!parsedKey.success) throw new ValidationError({ templateKey: ['invalid'] });
  return (
    opts.tx ? (async () => opts.tx!)() : withTenant(ctx, async (tx) => tx, { db: opts.db })
  ).then(async (tx) => {
    const [template] = await tx
      .select()
      .from(automationTemplates)
      .where(eq(automationTemplates.key, parsedKey.data))
      .limit(1);
    if (!template) throw new AppError('NOT_FOUND');
    if (template.moduleKey && !moduleSatisfied(modules, { module: template.moduleKey as never }))
      throw new AppError('MODULE_DISABLED');
    const [row] = await tx
      .insert(automations)
      .values({
        tenantId: sql`app_tenant_id()`,
        kind: 'template',
        templateKey: template.key,
        name: template.label,
        enabled,
        config: {}
      })
      .onConflictDoUpdate({
        target: [automations.tenantId, automations.templateKey],
        set: { enabled, updatedAt: sql`now()` }
      })
      .returning();
    if (!enabled)
      await tx
        .update(automationRuns)
        .set({
          status: 'stopped_module_off',
          stopReason: 'template_disabled',
          updatedAt: sql`now()`
        })
        .where(and(eq(automationRuns.automationId, row.id), eq(automationRuns.status, 'active')));
    await audit(tx, {
      action: 'automation.toggle',
      entity: 'automation',
      entityId: row.id,
      after: { templateKey: template.key, enabled }
    });
    return row;
  });
}
