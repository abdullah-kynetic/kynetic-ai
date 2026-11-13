import { ProviderError } from '../errors';
import { getEnv } from '../../env';
import type { LlmProvider, LlmRequest, LlmResponse } from './types';

export * from './types';

// Kept on globalThis for the same reason as the email provider: app and worker module graphs differ.
const KEY = Symbol.for('kynetic.llmProvider');
type Slot = { [KEY]?: LlmProvider };

/** Wired at boot to OpenRouter (live) or the fake (stub mode, tests). */
export function setLlmProvider(p: LlmProvider | undefined): void {
  (globalThis as Slot)[KEY] = p;
}

export function llmEnabled(): boolean {
  return getEnv().LLM_ENABLED;
}

/** Throws unless the master switch is on. No code path reaches a provider without passing here. */
export function getLlmProvider(): LlmProvider {
  if (!llmEnabled()) {
    throw new ProviderError('config', 'llm_disabled', 'Model calls are switched off (LLM_ENABLED)');
  }
  const provider = (globalThis as Slot)[KEY];
  if (!provider)
    throw new ProviderError('config', 'llm_not_configured', 'No model provider is configured');
  return provider;
}

/** The one door to a model. Callers go through `server/llm`, which adds the cap, metering and audit. */
export async function completeWithProvider(request: LlmRequest): Promise<LlmResponse> {
  const provider = getLlmProvider();
  if (request.dataHandling !== 'no_retention' && request.dataHandling !== 'standard') {
    throw new ProviderError('config', 'data_handling', 'A request must state its data handling');
  }
  return provider.complete(request);
}
