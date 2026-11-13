import { ProviderError } from '../errors';
import type { LlmProvider, LlmRequest, LlmResponse } from './types';

/** Plausible stand-in answers so a stub-mode portal can show every feature without a model. */
function defaultAnswer(r: LlmRequest): string {
  if (!r.json) return 'FAKE_LLM_RESPONSE';
  if (r.task === 'call_summary') {
    return JSON.stringify({
      summary: 'Sample summary from the stand-in model.',
      outcome_tag: 'other'
    });
  }
  if (r.task === 'message_draft') {
    return JSON.stringify({
      subject: 'A quick note',
      body: 'Hi, this is a sample draft from the stand-in model.'
    });
  }
  return JSON.stringify({ headline: 'Sample brief from the stand-in model.', facts: [] });
}

type Responder = (request: LlmRequest) => string | Promise<string>;

/** The only model client CI uses. It never touches the network. */
export class FakeLlmProvider implements LlmProvider {
  readonly id = 'fake' as const;
  readonly calls: LlmRequest[] = [];
  /** Cost reported for every call, in millionths of a dollar. */
  costMicros: number | null = 1_000;
  /** Replace to script the answer for a test. */
  respond: Responder = (r) => defaultAnswer(r);
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
