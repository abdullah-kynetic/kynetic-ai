import { LLM_TASKS, type LlmTask } from '@/server/adapters/llm/types';

/**
 * One model per task. `model` is null until a model has been chosen by running that task's eval set
 * (`bun run llm:eval`), because a model id is never guessed. A task with no model refuses to run.
 * Swap without a code change by setting LLM_MODELS to JSON, e.g. {"call_summary":"vendor/name"}.
 */
export type LlmTaskConfig = {
  model: string | null;
  maxTokens: number;
  temperature: number;
};

export const LLM_MODEL_MAP: Record<LlmTask, LlmTaskConfig> = {
  // Cheap model: sorting and summarizing.
  call_summary: { model: null, maxTokens: 500, temperature: 0.1 },
  // Stronger model: the words go to a customer after a person approves them.
  message_draft: { model: null, maxTokens: 400, temperature: 0.5 },
  // Stronger model: wrong facts cost money.
  lead_brief: { model: null, maxTokens: 900, temperature: 0.1 }
};

export function resolveTaskConfig(
  task: LlmTask,
  overridesJson: string | undefined
): LlmTaskConfig & { model: string } {
  const base = LLM_MODEL_MAP[task];
  let override: unknown;
  if (overridesJson) {
    try {
      override = (JSON.parse(overridesJson) as Record<string, unknown>)[task];
    } catch {
      throw new Error('LLM_MODELS is not valid JSON');
    }
  }
  const model = typeof override === 'string' && override.trim() ? override.trim() : base.model;
  if (!model) throw new Error(`No model chosen for ${task}`);
  return { ...base, model };
}

export { LLM_TASKS };
