import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { audit } from '../audit';
import { can, type Actor } from '../auth/permissions';
import type { Db, Tx } from '../db/client';
import {
  automations,
  automationSteps,
  automationTemplates,
  automationVersions
} from '../db/schema';
import { AppError, ValidationError } from '../errors';
import { withTenant, type TenantContextInput } from '../tenancy';
import { parseInput } from '../validation';

// KI-028. A client changes the wait and the wording of a follow-up sequence; a Kynetic admin approves
// the change before it takes effect. Every edit is a numbered version. Consent, quiet hours and the
// do-not-call list are NOT checked here: they are checked again at send time for every message, so an
// approved edit can never get around them (the outbound gate stays the only way a text leaves).

/** Templates whose messages are a list of steps. The others send fixed wording. */
export const EDITABLE_TEMPLATES = [
  'quote_followup',
  'reactivation',
  'appointment_reminders',
  'no_show_recovery'
] as const;
export type EditableTemplate = (typeof EDITABLE_TEMPLATES)[number];

export const MAX_STEPS = 6;
export const MAX_BODY_CHARS = 320; // two SMS segments
export const MAX_DELAY_MINUTES = 30 * 24 * 60;
export const MIN_GAP_MINUTES = 60;

export const stepSchema = z.strictObject({
  channel: z.literal('sms'),
  delayMinutes: z.number().int().min(0).max(MAX_DELAY_MINUTES),
  body: z.string().trim().min(1).max(MAX_BODY_CHARS)
});
export const stepsSchema = z.array(stepSchema).min(1).max(MAX_STEPS);
export type AutomationStepInput = z.infer<typeof stepSchema>;

const SHORTENERS = /\b(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rb\.gy)\b/i;
const OPT_OUT = /reply\s+stop\b/i;

/**
 * The compliance gate for copy and cadence. Returns field problems keyed `steps.<n>.<field>`; empty
 * means the steps may be proposed or approved. Rules, each with its reason:
 *  - the first message carries opt-out wording (carrier registration requires it on message one);
 *  - no placeholders: the sender does not fill them in, so a "{{name}}" would go out as typed;
 *  - no link shorteners, which carriers filter;
 *  - messages at least an hour apart and at most six in total over 30 days (frequency cap).
 */
export function checkSequence(steps: readonly AutomationStepInput[]): Record<string, string[]> {
  const problems: Record<string, string[]> = {};
  const add = (key: string, code: string) => (problems[key] = [...(problems[key] ?? []), code]);
  let elapsed = 0;
  steps.forEach((step, i) => {
    if (i === 0 && !OPT_OUT.test(step.body)) add('steps.0.body', 'missing_opt_out');
    if (/[{}]|\[\[|\]\]|<[a-z_ ]+>/i.test(step.body)) add(`steps.${i}.body`, 'placeholder');
    if (SHORTENERS.test(step.body)) add(`steps.${i}.body`, 'link_shortener');
    if (i > 0 && step.delayMinutes < MIN_GAP_MINUTES) add(`steps.${i}.delayMinutes`, 'too_soon');
    elapsed += step.delayMinutes;
  });
  if (elapsed > MAX_DELAY_MINUTES) add('steps', 'sequence_too_long');
  return problems;
}

function validate(raw: unknown): AutomationStepInput[] {
  const steps = parseInput(stepsSchema, raw);
  const problems = checkSequence(steps);
  if (Object.keys(problems).length) throw new ValidationError(problems);
  return steps;
}

const keySchema = z.enum(EDITABLE_TEMPLATES);

function run<T>(ctx: TenantContextInput, opts: { db?: Db; tx?: Tx }, fn: (tx: Tx) => Promise<T>) {
  return opts.tx ? fn(opts.tx) : withTenant(ctx, fn, { db: opts.db });
}

async function automationFor(tx: Tx, templateKey: EditableTemplate) {
  const [template] = await tx
    .select()
    .from(automationTemplates)
    .where(eq(automationTemplates.key, templateKey))
    .limit(1);
  if (!template) throw new AppError('NOT_FOUND');
  // The row is created off, as toggling does; editing never turns a sequence on.
  await tx
    .insert(automations)
    .values({
      tenantId: sql`app_tenant_id()`,
      kind: 'template',
      templateKey: template.key,
      name: template.label,
      enabled: false,
      config: {}
    })
    .onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(automations)
    .where(and(eq(automations.templateKey, templateKey), eq(automations.kind, 'template')))
    .limit(1);
  return row!;
}

export type AutomationVersion = typeof automationVersions.$inferSelect;

/** A client proposes new steps. Replaces any proposal still waiting. Nothing changes until approval. */
export async function proposeAutomationEdit(
  ctx: TenantContextInput,
  actor: Actor,
  templateKey: string,
  rawSteps: unknown,
  opts: { db?: Db; tx?: Tx } = {}
): Promise<AutomationVersion> {
  if (!can(actor, 'automations.edit', ctx.tenantId)) throw new AppError('FORBIDDEN');
  const key = parseInput(keySchema, templateKey);
  const steps = validate(rawSteps);
  return run(ctx, opts, async (tx) => {
    const automation = await automationFor(tx, key);
    // One pending proposal per automation: a new one replaces the old one.
    await tx
      .update(automationVersions)
      .set({ status: 'superseded', decidedAt: sql`now()`, decidedBy: actor.userId })
      .where(
        and(
          eq(automationVersions.automationId, automation.id),
          eq(automationVersions.status, 'pending')
        )
      );
    const [last] = await tx
      .select({ version: automationVersions.version })
      .from(automationVersions)
      .where(eq(automationVersions.automationId, automation.id))
      .orderBy(desc(automationVersions.version))
      .limit(1);
    const [row] = await tx
      .insert(automationVersions)
      .values({
        tenantId: sql`app_tenant_id()`,
        automationId: automation.id,
        version: (last?.version ?? 0) + 1,
        steps,
        status: 'pending',
        proposedBy: actor.userId
      })
      .returning();
    await audit(tx, {
      action: 'automation.edit_proposed',
      entity: 'automation',
      entityId: automation.id,
      after: { templateKey: key, version: row!.version, steps: steps.length }
    });
    return row!;
  });
}

async function pendingVersion(tx: Tx, versionId: string) {
  const [v] = await tx
    .select()
    .from(automationVersions)
    .where(eq(automationVersions.id, versionId))
    .for('update')
    .limit(1);
  if (!v) throw new AppError('NOT_FOUND');
  if (v.status !== 'pending') throw new AppError('CONFLICT');
  return v;
}

/**
 * A Kynetic admin approves a pending version. The steps are checked again, because the rules may have
 * changed since the proposal, then written to automation_steps in the same transaction. A run already
 * in progress carries on with the new steps from its current position.
 */
export async function approveAutomationEdit(
  ctx: TenantContextInput,
  actor: Actor,
  versionId: string,
  note: string | null = null,
  opts: { db?: Db; tx?: Tx } = {}
): Promise<AutomationVersion> {
  if (!can(actor, 'automations.approve', ctx.tenantId)) throw new AppError('FORBIDDEN');
  return run(ctx, opts, async (tx) => {
    const pending = await pendingVersion(tx, parseInput(z.uuid(), versionId));
    const steps = validate(pending.steps);
    await tx
      .update(automationVersions)
      .set({ status: 'superseded' })
      .where(
        and(
          eq(automationVersions.automationId, pending.automationId),
          eq(automationVersions.status, 'approved')
        )
      );
    await tx.delete(automationSteps).where(eq(automationSteps.automationId, pending.automationId));
    await tx.insert(automationSteps).values(
      steps.map((s, i) => ({
        tenantId: pending.tenantId,
        automationId: pending.automationId,
        position: i + 1,
        channel: s.channel,
        delayMinutes: s.delayMinutes,
        body: s.body
      }))
    );
    const [row] = await tx
      .update(automationVersions)
      .set({
        status: 'approved',
        decidedBy: actor.userId,
        decidedAt: sql`now()`,
        decisionNote: note?.trim() || null
      })
      .where(eq(automationVersions.id, pending.id))
      .returning();
    await audit(tx, {
      action: 'automation.edit_approved',
      entity: 'automation',
      entityId: pending.automationId,
      after: { version: pending.version, steps: steps.length }
    });
    return row!;
  });
}

export async function rejectAutomationEdit(
  ctx: TenantContextInput,
  actor: Actor,
  versionId: string,
  note: string | null = null,
  opts: { db?: Db; tx?: Tx } = {}
): Promise<AutomationVersion> {
  if (!can(actor, 'automations.approve', ctx.tenantId)) throw new AppError('FORBIDDEN');
  return run(ctx, opts, async (tx) => {
    const pending = await pendingVersion(tx, parseInput(z.uuid(), versionId));
    const [row] = await tx
      .update(automationVersions)
      .set({
        status: 'rejected',
        decidedBy: actor.userId,
        decidedAt: sql`now()`,
        decisionNote: note?.trim() || null
      })
      .where(eq(automationVersions.id, pending.id))
      .returning();
    await audit(tx, {
      action: 'automation.edit_rejected',
      entity: 'automation',
      entityId: pending.automationId,
      after: { version: pending.version }
    });
    return row!;
  });
}

export type AutomationEditState = {
  current: { position: number; channel: string; delayMinutes: number; body: string }[];
  pending: AutomationVersion | null;
  history: AutomationVersion[];
};

export async function getAutomationEditState(
  ctx: TenantContextInput,
  templateKey: string,
  opts: { db?: Db; tx?: Tx } = {}
): Promise<AutomationEditState> {
  const key = parseInput(keySchema, templateKey);
  return run(ctx, opts, async (tx) => {
    const [automation] = await tx
      .select({ id: automations.id })
      .from(automations)
      .where(and(eq(automations.templateKey, key), eq(automations.kind, 'template')))
      .limit(1);
    if (!automation) return { current: [], pending: null, history: [] };
    const current = await tx
      .select({
        position: automationSteps.position,
        channel: automationSteps.channel,
        delayMinutes: automationSteps.delayMinutes,
        body: automationSteps.body
      })
      .from(automationSteps)
      .where(eq(automationSteps.automationId, automation.id))
      .orderBy(asc(automationSteps.position));
    const history = await tx
      .select()
      .from(automationVersions)
      .where(eq(automationVersions.automationId, automation.id))
      .orderBy(desc(automationVersions.version));
    return { current, pending: history.find((v) => v.status === 'pending') ?? null, history };
  });
}
