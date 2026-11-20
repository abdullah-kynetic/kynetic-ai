import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import type { Db, Tx } from '../db/client';
import {
  accountTemplates,
  alexConfigs,
  automationSteps,
  automations,
  customFieldDefs,
  pipelineStages,
  pipelines,
  tags,
  tenantModules,
  tenants
} from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { MODULE_KEYS } from '../modules/keys';
import { withPlatform, withTenant } from '../tenancy';

/**
 * Account templates: GoHighLevel-style snapshots of one client's setup, used to preload a new client.
 *
 * A snapshot holds configuration only: modules, services, pipelines and stages, custom fields, tags,
 * automations (always applied switched off) and the Alex call settings. It never holds contacts,
 * deals, calls, messages, consent, secrets, phone numbers, service tokens, agent ids or branding.
 * The source client's name is replaced by `{{business_name}}` on save and by the new name on apply.
 */

export const BUSINESS_NAME_TOKEN = '{{business_name}}';

type Actor = { id: string; kyneticRole: 'admin' | 'va' | null };

const text = (max: number) => z.string().max(max);
const jsonValue = z.unknown();

const stageSchema = z.strictObject({
  name: text(80).min(1),
  position: z.number().int().min(0),
  probability: z.number().int().min(0).max(100),
  isWon: z.boolean(),
  isLost: z.boolean(),
  color: text(20).nullable()
});

export const snapshotSchema = z.strictObject({
  version: z.literal(1),
  services: z.array(text(120)).max(100),
  recordingDisclosure: text(2000).nullable(),
  modules: z
    .array(
      z.strictObject({
        key: z.enum(MODULE_KEYS).refine((k) => k !== 'platform'),
        level: text(20)
      })
    )
    .max(MODULE_KEYS.length),
  pipelines: z
    .array(
      z.strictObject({
        name: text(80).min(1),
        isDefault: z.boolean(),
        position: z.number().int().min(0),
        stages: z.array(stageSchema).min(1).max(30)
      })
    )
    .max(20),
  customFields: z
    .array(
      z.strictObject({
        entity: text(40).min(1),
        key: text(80).min(1),
        label: text(120).min(1),
        type: text(40).min(1),
        options: jsonValue,
        showInTable: z.boolean(),
        filterable: z.boolean(),
        importable: z.boolean(),
        position: z.number().int()
      })
    )
    .max(200),
  tags: z.array(text(80).min(1)).max(500),
  automations: z
    .array(
      z.strictObject({
        kind: text(40).min(1),
        templateKey: text(80).nullable(),
        name: text(160).min(1),
        config: jsonValue,
        steps: z
          .array(
            z.strictObject({
              position: z.number().int().min(0),
              channel: text(20).min(1),
              delayMinutes: z.number().int().min(0),
              subject: text(500).nullable(),
              body: text(5000)
            })
          )
          .max(50)
      })
    )
    .max(50),
  alex: z
    .strictObject({
      voice: text(120).nullable(),
      greeting: text(2000).nullable(),
      questions: jsonValue,
      bookingRules: jsonValue,
      callWindows: jsonValue,
      retry: jsonValue
    })
    .nullable()
});

export type AccountSnapshot = z.infer<typeof snapshotSchema>;

export type AccountTemplateSummary = {
  id: string;
  name: string;
  description: string;
  sourceTenantId: string | null;
  createdAt: string;
  counts: {
    modules: number;
    pipelines: number;
    stages: number;
    customFields: number;
    tags: number;
    automations: number;
  };
  hasAlex: boolean;
};

function requireAdmin(actor: Actor) {
  if (actor.kyneticRole !== 'admin') throw new AppError('FORBIDDEN');
}

function requireStaff(actor: Actor) {
  if (actor.kyneticRole !== 'admin' && actor.kyneticRole !== 'va') throw new AppError('FORBIDDEN');
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Swaps the business name for the token (on save) or the token for the name (on apply). */
export function swapName(value: string | null, from: string, to: string): string | null {
  if (value == null || !from.trim()) return value;
  return value.replace(new RegExp(escapeRegExp(from), 'g'), to);
}

/** Reads one client's setup as a snapshot. Runs read-only in that client's context. */
export async function captureAccountSnapshot(
  actor: Actor,
  tenantId: string,
  opts: { db?: Db } = {}
): Promise<{ snapshot: AccountSnapshot; tenantName: string }> {
  requireAdmin(actor);
  if (!z.uuid().safeParse(tenantId).success) throw new AppError('NOT_FOUND');
  return withTenant(
    { tenantId, userId: actor.id, role: 'admin', readOnly: true },
    async (tx) => {
      const [tenant] = await tx
        .select({
          name: tenants.name,
          services: tenants.services,
          recordingDisclosure: tenants.recordingDisclosure
        })
        .from(tenants)
        .where(eq(tenants.id, tenantId))
        .limit(1);
      if (!tenant) throw new AppError('NOT_FOUND');
      const toToken = (v: string | null) => swapName(v, tenant.name, BUSINESS_NAME_TOKEN);

      const moduleRows = await tx
        .select({ key: tenantModules.moduleKey, level: tenantModules.level })
        .from(tenantModules)
        .where(eq(tenantModules.enabled, true));

      const pipelineRows = await tx
        .select()
        .from(pipelines)
        .orderBy(asc(pipelines.position), asc(pipelines.createdAt));
      const stageRows = await tx
        .select()
        .from(pipelineStages)
        .orderBy(asc(pipelineStages.position));

      const fieldRows = await tx
        .select()
        .from(customFieldDefs)
        .orderBy(asc(customFieldDefs.entity), asc(customFieldDefs.position));
      const tagRows = await tx.select({ name: tags.name }).from(tags).orderBy(asc(tags.name));
      const automationRows = await tx
        .select()
        .from(automations)
        .orderBy(asc(automations.createdAt));
      const stepRows = await tx
        .select()
        .from(automationSteps)
        .orderBy(asc(automationSteps.position));
      const [alex] = await tx.select().from(alexConfigs).limit(1);

      const snapshot: AccountSnapshot = {
        version: 1,
        services: Array.isArray(tenant.services)
          ? tenant.services.filter((s): s is string => typeof s === 'string')
          : [],
        recordingDisclosure: toToken(tenant.recordingDisclosure),
        modules: moduleRows
          .filter((m) => m.key !== 'platform' && (MODULE_KEYS as readonly string[]).includes(m.key))
          .map((m) => ({
            key: m.key as Exclude<(typeof MODULE_KEYS)[number], 'platform'>,
            level: m.level ?? ''
          })),
        pipelines: pipelineRows.map((p) => ({
          name: p.name,
          isDefault: p.isDefault,
          position: p.position,
          stages: stageRows
            .filter((s) => s.pipelineId === p.id)
            .map((s) => ({
              name: s.name,
              position: s.position,
              probability: s.probability,
              isWon: s.isWon,
              isLost: s.isLost,
              color: s.color ?? null
            }))
        })),
        customFields: fieldRows.map((f) => ({
          entity: f.entity,
          key: f.key,
          label: f.label,
          type: f.type,
          options: f.options,
          showInTable: f.showInTable,
          filterable: f.filterable,
          importable: f.importable,
          position: f.position
        })),
        tags: tagRows.map((t) => t.name),
        automations: automationRows.map((a) => ({
          kind: a.kind,
          templateKey: a.templateKey,
          name: a.name,
          config: a.config,
          steps: stepRows
            .filter((s) => s.automationId === a.id)
            .map((s) => ({
              position: s.position,
              channel: s.channel,
              delayMinutes: s.delayMinutes,
              subject: toToken(s.subject),
              body: toToken(s.body) ?? ''
            }))
        })),
        alex: alex
          ? {
              voice: alex.voice,
              greeting: toToken(alex.greeting),
              questions: alex.questions,
              bookingRules: alex.bookingRules,
              callWindows: alex.callWindows,
              retry: alex.retry
            }
          : null
      };
      return {
        snapshot: snapshotSchema.parse(snapshot),
        tenantName: tenant.name
      };
    },
    opts
  );
}

const saveInputSchema = z.strictObject({
  sourceTenantId: z.uuid(),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(500).default('')
});

function pgCode(err: unknown): string | undefined {
  for (let e: unknown = err; e && typeof e === 'object'; e = (e as { cause?: unknown }).cause) {
    const code = (e as { code?: unknown }).code;
    if (typeof code === 'string') return code;
  }
  return undefined;
}

/** Saves a client's current setup as a named template. Admin only. */
export async function saveAccountTemplate(
  actor: Actor,
  raw: unknown,
  opts: { db?: Db } = {}
): Promise<{ id: string }> {
  requireAdmin(actor);
  const parsed = saveInputSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError(z.flattenError(parsed.error).fieldErrors);
  const input = parsed.data;
  const { snapshot, tenantName } = await captureAccountSnapshot(actor, input.sourceTenantId, opts);
  try {
    return await withPlatform(
      { userId: actor.id, role: 'admin' },
      async (tx) => {
        const [row] = await tx
          .insert(accountTemplates)
          .values({
            name: input.name,
            description: input.description,
            sourceTenantId: input.sourceTenantId,
            snapshot,
            createdBy: actor.id
          })
          .returning({ id: accountTemplates.id });
        await audit(tx, {
          action: 'account_template.save',
          entity: 'account_template',
          entityId: row!.id,
          after: {
            name: input.name,
            sourceTenantId: input.sourceTenantId,
            sourceName: tenantName,
            counts: countSnapshot(snapshot)
          }
        });
        return { id: row!.id };
      },
      opts
    );
  } catch (err) {
    if (pgCode(err) === '23505')
      throw new AppError('CONFLICT', {
        message: 'A template with this name already exists. Pick another name.',
        fieldErrors: { name: ['in_use'] },
        cause: err
      });
    throw err;
  }
}

export function countSnapshot(s: AccountSnapshot): AccountTemplateSummary['counts'] {
  return {
    modules: s.modules.length,
    pipelines: s.pipelines.length,
    stages: s.pipelines.reduce((n, p) => n + p.stages.length, 0),
    customFields: s.customFields.length,
    tags: s.tags.length,
    automations: s.automations.length
  };
}

/** Templates that are not archived, newest first. Admin and VA. */
export async function listAccountTemplates(
  actor: Actor,
  opts: { db?: Db } = {}
): Promise<AccountTemplateSummary[]> {
  requireStaff(actor);
  const rows = await withPlatform(
    { userId: actor.id, role: actor.kyneticRole! },
    (tx) =>
      tx
        .select()
        .from(accountTemplates)
        .where(isNull(accountTemplates.archivedAt))
        .orderBy(desc(accountTemplates.createdAt)),
    opts
  );
  return rows.flatMap((r) => {
    const parsed = snapshotSchema.safeParse(r.snapshot);
    if (!parsed.success) return [];
    return [
      {
        id: r.id,
        name: r.name,
        description: r.description,
        sourceTenantId: r.sourceTenantId,
        createdAt: r.createdAt,
        counts: countSnapshot(parsed.data),
        hasAlex: parsed.data.alex !== null
      }
    ];
  });
}

/** Reads one live template's snapshot inside the caller's platform transaction (no client context yet). */
export async function loadTemplateSnapshot(tx: Tx, templateId: string): Promise<AccountSnapshot> {
  if (!z.uuid().safeParse(templateId).success)
    throw new ValidationError({ templateId: ['invalid'] });
  const [row] = await tx
    .select({ snapshot: accountTemplates.snapshot })
    .from(accountTemplates)
    .where(and(eq(accountTemplates.id, templateId), isNull(accountTemplates.archivedAt)))
    .limit(1);
  if (!row)
    throw new AppError('NOT_FOUND', {
      message: 'That template no longer exists.',
      fieldErrors: { templateId: ['not_found'] }
    });
  const parsed = snapshotSchema.safeParse(row.snapshot);
  if (!parsed.success)
    throw new AppError('VALIDATION_FAILED', {
      message: 'That template is damaged and cannot be used.'
    });
  return parsed.data;
}

/** Archives a template so it can no longer be applied. Clients already made from it keep their setup. */
export async function archiveAccountTemplate(
  actor: Actor,
  templateId: string,
  opts: { db?: Db } = {}
): Promise<void> {
  requireAdmin(actor);
  if (!z.uuid().safeParse(templateId).success) throw new AppError('NOT_FOUND');
  await withPlatform(
    { userId: actor.id, role: 'admin' },
    async (tx) => {
      const [row] = await tx
        .update(accountTemplates)
        .set({ archivedAt: sql`now()`, updatedAt: sql`now()` })
        .where(and(eq(accountTemplates.id, templateId), isNull(accountTemplates.archivedAt)))
        .returning({ id: accountTemplates.id, name: accountTemplates.name });
      if (!row) throw new AppError('NOT_FOUND');
      await audit(tx, {
        action: 'account_template.archive',
        entity: 'account_template',
        entityId: row.id,
        before: { name: row.name }
      });
    },
    opts
  );
}

/**
 * Writes a snapshot into a brand-new client. Must run inside the onboarding transaction after
 * `create_tenant`, so the new client is the transaction's tenant and every write passes its RLS.
 * The default pipeline that `create_tenant` made is reshaped to the template's default; automations
 * are created switched off; the Alex settings stay paused with no agent attached.
 */
export async function applySnapshotToNewTenant(
  tx: Tx,
  tenantId: string,
  businessName: string,
  snapshot: AccountSnapshot
): Promise<{
  pipelines: number;
  customFields: number;
  tags: number;
  automations: number;
}> {
  const fromToken = (v: string | null) => swapName(v, BUSINESS_NAME_TOKEN, businessName);

  const patch: Partial<typeof tenants.$inferInsert> = {};
  if (snapshot.services.length) patch.services = [...snapshot.services];
  if (snapshot.recordingDisclosure)
    patch.recordingDisclosure = fromToken(snapshot.recordingDisclosure);
  if (Object.keys(patch).length)
    await tx.update(tenants).set(patch).where(eq(tenants.id, tenantId));

  // Pipelines: the template's default replaces the stages of the one create_tenant made.
  const ordered = snapshot.pipelines.toSorted((a, b) => a.position - b.position);
  const templateDefault = ordered.find((p) => p.isDefault);
  if (templateDefault) {
    const [existing] = await tx
      .select({ id: pipelines.id })
      .from(pipelines)
      .where(eq(pipelines.isDefault, true))
      .limit(1);
    if (existing) {
      await tx.delete(pipelineStages).where(eq(pipelineStages.pipelineId, existing.id));
      await tx
        .update(pipelines)
        .set({ name: templateDefault.name })
        .where(eq(pipelines.id, existing.id));
      await insertStages(tx, tenantId, existing.id, templateDefault.stages);
    }
  }
  for (const p of ordered) {
    if (p === templateDefault) continue;
    const [row] = await tx
      .insert(pipelines)
      .values({
        tenantId,
        name: p.name,
        isDefault: false,
        position: p.position
      })
      .returning({ id: pipelines.id });
    await insertStages(tx, tenantId, row!.id, p.stages);
  }

  if (snapshot.customFields.length) {
    await tx
      .insert(customFieldDefs)
      .values(
        snapshot.customFields.map((f) => ({
          tenantId,
          entity: f.entity,
          key: f.key,
          label: f.label,
          type: f.type,
          options: f.options ?? [],
          showInTable: f.showInTable,
          filterable: f.filterable,
          importable: f.importable,
          position: f.position
        }))
      )
      .onConflictDoNothing();
  }

  if (snapshot.tags.length) {
    await tx
      .insert(tags)
      .values(snapshot.tags.map((name) => ({ tenantId, name })))
      .onConflictDoNothing();
  }

  for (const a of snapshot.automations) {
    const [row] = await tx
      .insert(automations)
      .values({
        tenantId,
        kind: a.kind,
        templateKey: a.templateKey,
        name: a.name,
        enabled: false,
        config: a.config ?? {}
      })
      .onConflictDoNothing()
      .returning({ id: automations.id });
    if (!row || !a.steps.length) continue;
    await tx.insert(automationSteps).values(
      a.steps.map((s) => ({
        tenantId,
        automationId: row.id,
        position: s.position,
        channel: s.channel,
        delayMinutes: s.delayMinutes,
        subject: fromToken(s.subject),
        body: fromToken(s.body) ?? ''
      }))
    );
  }

  if (snapshot.alex) {
    await tx
      .update(alexConfigs)
      .set({
        voice: snapshot.alex.voice,
        greeting: fromToken(snapshot.alex.greeting),
        questions: snapshot.alex.questions ?? [],
        bookingRules: snapshot.alex.bookingRules ?? {},
        callWindows: snapshot.alex.callWindows ?? {},
        retry: snapshot.alex.retry ?? {},
        paused: true,
        agentRef: null
      })
      .where(eq(alexConfigs.tenantId, tenantId));
  }

  return {
    pipelines: snapshot.pipelines.length,
    customFields: snapshot.customFields.length,
    tags: snapshot.tags.length,
    automations: snapshot.automations.length
  };
}

async function insertStages(
  tx: Tx,
  tenantId: string,
  pipelineId: string,
  stages: AccountSnapshot['pipelines'][number]['stages']
) {
  await tx.insert(pipelineStages).values(
    stages
      .toSorted((a, b) => a.position - b.position)
      .map((s, position) => ({
        tenantId,
        pipelineId,
        name: s.name,
        position,
        probability: s.probability,
        isWon: s.isWon,
        isLost: s.isLost,
        color: s.color
      }))
  );
}
