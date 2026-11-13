import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@/server/adapters/errors';
import { FakeLlmProvider } from '@/server/adapters/llm/fake';
import { completeWithProvider, getLlmProvider, setLlmProvider } from '@/server/adapters/llm';
import type { LlmRequest } from '@/server/adapters/llm';
import { parseEnv, resetEnvCacheForTests } from '@/server/env';

const baseEnv = {
  NODE_ENV: 'test',
  APP_BASE_URL: 'http://localhost:3000',
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  DATABASE_URL_AUTH: 'postgres://a:p@localhost:5432/db',
  BETTER_AUTH_SECRET: 'x'.repeat(32),
  APP_ENCRYPTION_KEY: 'y'.repeat(32)
};

const request: LlmRequest = {
  tenantId: 't1',
  task: 'call_summary',
  model: 'test/model',
  messages: [{ role: 'user', content: 'hello' }],
  maxTokens: 100,
  dataHandling: 'no_retention'
};

function stubEnv(extra: Record<string, string>) {
  for (const [k, v] of Object.entries({ ...baseEnv, ...extra })) vi.stubEnv(k, v);
  resetEnvCacheForTests();
}

describe('LLM adapter gate', () => {
  let fake: FakeLlmProvider;
  beforeEach(() => {
    fake = new FakeLlmProvider();
    setLlmProvider(fake);
  });
  afterEach(() => {
    setLlmProvider(undefined);
    vi.unstubAllEnvs();
    resetEnvCacheForTests();
  });

  it('P5-4: defaults to off and never reaches a provider while off', async () => {
    expect(parseEnv(baseEnv).LLM_ENABLED).toBe(false);
    stubEnv({});
    await expect(completeWithProvider(request)).rejects.toMatchObject({ code: 'llm_disabled' });
    expect(() => getLlmProvider()).toThrow(ProviderError);
    expect(fake.calls).toHaveLength(0);
  });

  it('calls the provider once the switch is on', async () => {
    stubEnv({ LLM_ENABLED: 'true', PROVIDER_MODE: 'stub' });
    const res = await completeWithProvider(request);
    expect(res.text).toBe('FAKE_LLM_RESPONSE');
    expect(fake.calls).toHaveLength(1);
  });

  it('fails closed when on with no provider wired', async () => {
    stubEnv({ LLM_ENABLED: 'true', PROVIDER_MODE: 'stub' });
    setLlmProvider(undefined);
    await expect(completeWithProvider(request)).rejects.toMatchObject({
      code: 'llm_not_configured'
    });
  });

  it('refuses a request that does not state its data handling', async () => {
    stubEnv({ LLM_ENABLED: 'true', PROVIDER_MODE: 'stub' });
    const bad = { ...request, dataHandling: undefined } as unknown as LlmRequest;
    await expect(completeWithProvider(bad)).rejects.toMatchObject({ code: 'data_handling' });
    expect(fake.calls).toHaveLength(0);
  });

  it('boot refuses LLM_ENABLED without a key outside stub mode', () => {
    expect(() => parseEnv({ ...baseEnv, LLM_ENABLED: 'true' })).toThrow(/OPENROUTER_API_KEY/);
    expect(() =>
      parseEnv({ ...baseEnv, LLM_ENABLED: 'true', OPENROUTER_API_KEY: 'k' })
    ).not.toThrow();
    expect(parseEnv(baseEnv).LLM_DATA_HANDLING).toBe('no_retention');
  });
});
