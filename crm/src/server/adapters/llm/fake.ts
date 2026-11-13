import { ProviderError } from '../errors';
import type { LlmProvider, LlmRequest, LlmResponse } from './types';

type Responder = (request: LlmRequest) => string | Promise<string>;

/** The only model client CI uses. It never touches the network. */
export class FakeLlmProvider implements LlmProvider {
  readonly id = 'fake' as const;
  readonly calls: LlmRequest[] = [];
  /** Cost reported for every call, in millionths of a dollar. */
  costMicros: number | null = 1_000;
  /** Replace to script the answer for a test. */
  respond: Responder = () => 'FAKE_LLM_RESPONSE';
  /** Set to make the next calls fail. */
  failWith: ProviderError | undefined;

  async complete(request: LlmRequest): Promise<LlmResponse> {
    this.calls.push(request);
    if (this.failWith) throw this.failWith;
    if (request.dataHandling !== 'no_retention' && request.dataHandling !== 'standard') {
      throw new ProviderError('config', 'data_handling', 'A request must state its data handling');
    }
    const text = await this.respond(request);
    const promptChars = request.messages.reduce((n, m) => n + m.content.length, 0);
    return {
      text,
      model: request.model,
      promptTokens: Math.ceil(promptChars / 4),
      completionTokens: Math.ceil(text.length / 4),
      costMicros: this.costMicros,
      providerId: `fake_llm_${this.calls.length}`
    };
  }
}
