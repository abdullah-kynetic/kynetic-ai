import { and, eq, sql } from 'drizzle-orm';
import { audit } from '@/server/audit';
import { resolveTaskConfig } from '@/config/llm-models';
import {
  completeWithProvider,
  getLlmProvider,
  type LlmMessage,
  type LlmResponse,
  type LlmTask
} from '@/server/adapters/llm';
import { ProviderError } from '@/server/adapters/errors';
import type { Db } from '@/server/db/client';
import { llmAudit, llmUsage } from '@/server/db/schema';
import { getEnv } from '@/server/env';
import { withTenant } from '@/server/tenancy';
import type { TenantContextInput } from '@/server/tenancy/context';

export type LlmRunInput = {
  tenantId: string;
  task: LlmTask;
  messages: LlmMessage[];
  json?: boolean;
  /** The client record this prompt is about. Required: a prompt with no subject is not logged. */
  subject: { type: string; id: string };
  /** Who asked. Null for a scheduled job. */
  requestedBy?: string | null;
  /** `pending` for anything a customer will read: it stays a draft until a person approves it. */
  approval?: 'not_required' | 'pending';
};

export type LlmRunResult = LlmResponse & { usageId: string; auditId: string };

/** Thrown when the client has used its monthly AI allowance. The admin has been told. */
export class LlmCapReachedError extends Error {
  constructor(readonly tenantId: string) {
    super('The monthly AI spend cap for this client has been reached');
    this.name = 'LlmCapReachedError';
  }
}

type Opts = { db?: Db };

/** Spend this month in the client's own timezone, and the cap that applies (cents). */
async function capState(tenantId: string, opts: Opts) {
  return withTenant(
    { tenantId, role: 'system' },
    async (tx) => {
      const [row] = await tx.execute<{ spent: string; cap: number | null }>(sql`
        select
          (select coalesce(sum(l.cost_micros), 0)::text from llm_usage l
            where l.created_at >= date_trunc('month', now() at time zone t.timezone) at time zone t.timezone) as spent,
          t.llm_monthly_cap_cents as cap
        from tenants t where t.id = ${tenantId}::uuid`);
      return {
        spentMicros: Number(row?.spent ?? 0),
        capCents: row?.cap ?? getEnv().LLM_DEFAULT_MONTHLY_CAP_CENTS
      };
    },
    opts
  );
}

/**
 * The only way a feature reaches a model. In order: master switch, chosen model, monthly cap, the call
 * (with the data-handling setting on it), then the usage row. Failures are recorded too so they show up.
 * The cap is checked before the call, so a burst of parallel calls can overshoot it by a few calls.
 */
export async function runLlmTask(input: LlmRunInput, opts: Opts = {}): Promise<LlmRunResult> {
  const env = getEnv();
  getLlmProvider(); // throws llm_disabled / llm_not_configured before anything else happens
  let cfg;
  try {
    cfg = resolveTaskConfig(input.task, env.LLM_MODELS);
  } catch (e) {
    throw new ProviderError('config', 'no_model', e instanceof Error ? e.message : 'No model');
  }
  const ctx = {
    tenantId: input.tenantId,
    role: 'system' as const,
    ...(input.requestedBy ? { userId: input.requestedBy } : {})
  };
  const auditBase = (usageId: string) => ({
    tenantId: input.tenantId,
    usageId,
    task: input.task,
    subjectType: input.subject.type,
    subjectId: input.subject.id,
    requestedBy: input.requestedBy ?? null,
    dataHandling: env.LLM_DATA_HANDLING,
    prompt: input.messages,
    approvalStatus: input.approval ?? 'not_required'
  });
  const state = await capState(input.tenantId, opts);
  if (state.spentMicros >= state.capCents * 10_000) {
    await withTenant(
      { tenantId: input.tenantId, role: 'system' },
      (tx) => tx.execute(sql`select note_llm_cap_reached(${input.tenantId}::uuid)`),
      opts
    );
    throw new LlmCapReachedError(input.tenantId);
  }
  let response: LlmResponse;
  try {
    response = await completeWithProvider({
      tenantId: input.tenantId,
      task: input.task,
      model: cfg.model,
      messages: input.messages,
      maxTokens: cfg.maxTokens,
      temperature: cfg.temperature,
      json: input.json,
      dataHandling: env.LLM_DATA_HANDLING
    });
  } catch (error) {
    await withTenant(
      ctx,
      async (tx) => {
        const [u] = await tx
          .insert(llmUsage)
          .values({
            tenantId: input.tenantId,
            task: input.task,
            model: cfg.model,
            status: 'failed',
            costKnown: false
          })
          .returning({ id: llmUsage.id });
        await tx.insert(llmAudit).values({ ...auditBase(u!.id), output: null });
      },
      opts
    );
    throw error;
  }
  const { usageId, auditId } = await withTenant(
    ctx,
    async (tx) => {
      const [row] = await tx
        .insert(llmUsage)
        .values({
          tenantId: input.tenantId,
          task: input.task,
          model: response.model,
          promptTokens: response.promptTokens,
          completionTokens: response.completionTokens,
          costMicros: response.costMicros ?? 0,
          costKnown: response.costMicros != null
        })
        .returning({ id: llmUsage.id });
      const [a] = await tx
        .insert(llmAudit)
        .values({ ...auditBase(row!.id), output: response.text })
        .returning({ id: llmAudit.id });
      return { usageId: row!.id, auditId: a!.id };
    },
    opts
  );
  return { ...response, usageId, auditId };
}

export type ApprovalDecision = 'approved' | 'rejected';

/**
 * A person approves or rejects a pending model output. Returns false when it was not pending (already
 * decided, or not found for this client). The decision is stamped with the signed-in person and also
 * written to the audit log.
 */
export async function decideLlmOutput(
  ctx: TenantContextInput & { userId: string },
  auditId: string,
  decision: ApprovalDecision,
  opts: Opts = {}
): Promise<boolean> {
  return withTenant(
    ctx,
    async (tx) => {
      const rows = await tx
        .update(llmAudit)
        .set({ approvalStatus: decision, approvedBy: ctx.userId, approvedAt: sql`now()` as never })
        .where(and(eq(llmAudit.id, auditId), eq(llmAudit.approvalStatus, 'pending')))
        .returning({ id: llmAudit.id, task: llmAudit.task });
      if (rows.length === 0) return false;
      await audit(tx, {
        action: `llm.${decision}`,
        entity: 'llm_audit',
        entityId: auditId,
        after: { task: rows[0]!.task }
      });
      return true;
    },
    opts
  );
}
