import { setLlmProvider } from '@/server/adapters/llm';
import { FakeLlmProvider } from '@/server/adapters/llm/fake';
import { OpenRouterProvider } from '@/server/adapters/llm/openrouter';
import { getEnv, type Env } from '@/server/env';

export type LlmWiring = 'openrouter' | 'fake' | 'off';

/** Safe to call from app and worker boot. Nothing is wired while LLM_ENABLED is false. */
export function wireLlm(env: Env = getEnv()): LlmWiring {
  if (!env.LLM_ENABLED) {
    setLlmProvider(undefined);
    return 'off';
  }
  if (env.PROVIDER_MODE === 'stub' || !env.OPENROUTER_API_KEY) {
    setLlmProvider(new FakeLlmProvider());
    return 'fake';
  }
  setLlmProvider(new OpenRouterProvider({ apiKey: env.OPENROUTER_API_KEY }));
  return 'openrouter';
}
