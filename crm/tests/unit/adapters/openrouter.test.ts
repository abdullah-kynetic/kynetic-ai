import { describe, expect, it } from 'vitest';
import { OpenRouterProvider } from '@/server/adapters/llm/openrouter';
import type { LlmRequest } from '@/server/adapters/llm';
import { resolveTaskConfig } from '@/config/llm-models';

const req: LlmRequest = {
  tenantId: 't',
  task: 'call_summary',
  model: 'vendor/model',
  messages: [{ role: 'user', content: 'hi' }],
  maxTokens: 50,
  json: true,
  dataHandling: 'no_retention'
};

function mock(status: number, body: unknown, seen: { body?: Record<string, unknown> } = {}) {
  return (async (_url: string, init: RequestInit) => {
    seen.body = JSON.parse(String(init.body));
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
}

describe('OpenRouter adapter (mocked transport)', () => {
  it('sends zero-retention routing and reads text, tokens and cost', async () => {
    const seen: { body?: Record<string, unknown> } = {};
    const p = new OpenRouterProvider({
      apiKey: 'k',
      fetch: mock(
        200,
        {
          id: 'gen-1',
          model: 'vendor/model',
          choices: [{ message: { content: '{"a":1}' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, cost: 0.00042 }
        },
        seen
      )
    });
    const r = await p.complete(req);
    expect(r).toMatchObject({
      text: '{"a":1}',
      promptTokens: 10,
      completionTokens: 5,
      costMicros: 420
    });
    expect(seen.body?.provider).toMatchObject({ data_collection: 'deny', zdr: true });
    expect(seen.body?.response_format).toEqual({ type: 'json_object' });
  });

  it('does not demand zero retention for standard handling', async () => {
    const seen: { body?: Record<string, unknown> } = {};
    const p = new OpenRouterProvider({
      apiKey: 'k',
      fetch: mock(200, { choices: [{ message: { content: 'x' } }] }, seen)
    });
    const r = await p.complete({ ...req, dataHandling: 'standard' });
    expect(seen.body?.provider).not.toHaveProperty('zdr');
    expect(r.costMicros).toBeNull();
  });

  it.each([
    [401, 'config'],
    [429, 'transient'],
    [503, 'transient'],
    [400, 'permanent']
  ])('maps http %i to %s', async (status, kind) => {
    const p = new OpenRouterProvider({ apiKey: 'k', fetch: mock(status, {}) });
    await expect(p.complete(req)).rejects.toMatchObject({ kind });
  });

  it('treats a network failure as transient and empty text as an error', async () => {
    const down = (async () => {
      throw new Error('x');
    }) as unknown as typeof fetch;
    await expect(
      new OpenRouterProvider({ apiKey: 'k', fetch: down }).complete(req)
    ).rejects.toMatchObject({
      kind: 'transient'
    });
    const empty = new OpenRouterProvider({ apiKey: 'k', fetch: mock(200, { choices: [] }) });
    await expect(empty.complete(req)).rejects.toMatchObject({ code: 'empty' });
  });
});

describe('model map', () => {
  it('refuses a task with no chosen model and takes an override without a code change', () => {
    expect(() => resolveTaskConfig('lead_brief', undefined)).toThrow(/No model chosen/);
    expect(resolveTaskConfig('lead_brief', '{"lead_brief":"vendor/x"}').model).toBe('vendor/x');
    expect(() => resolveTaskConfig('lead_brief', '{bad')).toThrow(/valid JSON/);
  });
});
