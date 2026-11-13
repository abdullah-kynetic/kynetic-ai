import { ProviderError } from '../errors';
import type { LlmProvider, LlmRequest, LlmResponse } from './types';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

export type OpenRouterOptions = {
  apiKey: string;
  fetch?: typeof fetch;
  /** Sent as X-Title so usage shows under the portal in OpenRouter's dashboard. */
  appTitle?: string;
  timeoutMs?: number;
};

type Completion = {
  model?: string;
  id?: string;
  choices?: { message?: { content?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
};

/**
 * OpenRouter adapter. The only real model client in the portal. Reach it through
 * `completeWithProvider`, never directly, so the switch, cap, metering and audit all apply.
 */
export class OpenRouterProvider implements LlmProvider {
  readonly id = 'openrouter' as const;
  private readonly doFetch: typeof fetch;

  constructor(private readonly opts: OpenRouterOptions) {
    this.doFetch = opts.fetch ?? fetch;
  }

  async complete(r: LlmRequest): Promise<LlmResponse> {
    // `no_retention`: only endpoints that do not collect or retain prompts (zero data retention).
    const provider =
      r.dataHandling === 'no_retention'
        ? { data_collection: 'deny', zdr: true, require_parameters: true }
        : { require_parameters: true };
    let res: Response;
    try {
      res = await this.doFetch(API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opts.apiKey}`,
          'Content-Type': 'application/json',
          'X-Title': this.opts.appTitle ?? 'Kynetic portal'
        },
        body: JSON.stringify({
          model: r.model,
          messages: r.messages,
          max_tokens: r.maxTokens,
          temperature: r.temperature ?? 0.2,
          ...(r.json ? { response_format: { type: 'json_object' } } : {}),
          provider,
          usage: { include: true }
        }),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 60_000)
      });
    } catch {
      throw new ProviderError('transient', 'network', 'OpenRouter could not be reached');
    }
    if (!res.ok) {
      const config = res.status === 401 || res.status === 402 || res.status === 403;
      const transient = res.status === 408 || res.status === 429 || res.status >= 500;
      throw new ProviderError(
        config ? 'config' : transient ? 'transient' : 'permanent',
        `http_${res.status}`,
        `OpenRouter returned ${res.status}`
      );
    }
    let body: Completion;
    try {
      body = (await res.json()) as Completion;
    } catch {
      throw new ProviderError('transient', 'bad_body', 'OpenRouter returned an unreadable body');
    }
    const text = body.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.length === 0) {
      throw new ProviderError('transient', 'empty', 'OpenRouter returned no text');
    }
    const cost = body.usage?.cost;
    return {
      text,
      model: body.model ?? r.model,
      promptTokens: body.usage?.prompt_tokens ?? 0,
      completionTokens: body.usage?.completion_tokens ?? 0,
      costMicros: typeof cost === 'number' && cost >= 0 ? Math.round(cost * 1_000_000) : null,
      providerId: body.id ?? ''
    };
  }
}
