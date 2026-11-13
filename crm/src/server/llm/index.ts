import { sql } from 'drizzle-orm';
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
import { llmUsage } from '@/server/db/schema';
import { getEnv } from '@/server/env';
import { withTenant } from '@/server/tenancy';

export type LlmRunInput = {
  tenantId: string;
  task: LlmTask;
  messages: LlmMessage[];
  json?: boolean;
};

export type LlmRunResult = LlmResponse & { usageId: string };

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
      { tenantId: input.tenantId, role: 'system' },
      (tx) =>
        tx.insert(llmUsage).values({
          tenantId: input.tenantId,
          task: input.task,
          model: cfg.model,
          status: 'failed',
          costKnown: false
        }),
      opts
    );
    throw error;
  }
  const usageId = await withTenant(
    { tenantId: input.tenantId, role: 'system' },
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
      return row!.id;
    },
    opts
  );
  return { ...response, usageId };
}
