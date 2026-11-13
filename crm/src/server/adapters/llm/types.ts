/** The model-backed jobs the portal runs. Each one has its own entry in the model map (config/llm-models.ts). */
export const LLM_TASKS = ['call_summary', 'message_draft', 'lead_brief'] as const;
export type LlmTask = (typeof LLM_TASKS)[number];

/**
 * What a provider may do with a prompt after answering it. Every request states this; there is no
 * default at the adapter. `no_retention` asks the provider to route only to endpoints that do not
 * store or train on prompts. `standard` accepts the provider's default handling and is for test or
 * non-client data only.
 */
export type LlmDataHandling = 'no_retention' | 'standard';

export type LlmMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export type LlmRequest = {
  tenantId: string;
  task: LlmTask;
  /** Provider model id, resolved from the model map by the caller. */
  model: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
  /** Ask for a single JSON object as the answer. */
  json?: boolean;
  dataHandling: LlmDataHandling;
};

export type LlmResponse = {
  text: string;
  /** The model that actually answered, which can differ from the one asked for. */
  model: string;
  promptTokens: number;
  completionTokens: number;
  /** Cost in millionths of a US dollar as reported by the provider, or null when it did not say. */
  costMicros: number | null;
  providerId: string;
};

export interface LlmProvider {
  readonly id: 'openrouter' | 'fake';
  complete(request: LlmRequest): Promise<LlmResponse>;
}
