import type { LlmProvider, LlmTask } from '@/server/adapters/llm';
import { buildCallSummaryMessages, parseCallSummary } from '../features/call-summary';

export type EvalCaseResult = { id: string; pass: boolean; reasons: string[]; output: string };
export type EvalReport = {
  task: LlmTask;
  model: string;
  total: number;
  passed: number;
  rate: number;
  results: EvalCaseResult[];
};

/** A task passes its eval when at least this share of cases pass. */
export const EVAL_PASS_RATE: Record<LlmTask, number> = {
  call_summary: 0.85,
  message_draft: 0.85,
  lead_brief: 0.85
};

export type CallSummaryCase = {
  id: string;
  transcript: string;
  expectTag: string;
  mustMention: string[];
  mustNotMention: string[];
};

export function scoreCallSummary(c: CallSummaryCase, output: string): EvalCaseResult {
  const reasons: string[] = [];
  try {
    const { summary, outcomeTag } = parseCallSummary(output);
    if (outcomeTag !== c.expectTag) reasons.push(`tag ${outcomeTag}, wanted ${c.expectTag}`);
    const low = summary.toLowerCase();
    for (const w of c.mustMention) if (!low.includes(w)) reasons.push(`missing "${w}"`);
    for (const w of c.mustNotMention) if (low.includes(w)) reasons.push(`should not say "${w}"`);
  } catch (e) {
    reasons.push(e instanceof Error ? e.message : 'unreadable');
  }
  return { id: c.id, pass: reasons.length === 0, reasons, output };
}

export type EvalDeps = { provider: LlmProvider; model: string };

export async function runCallSummaryEval(
  cases: CallSummaryCase[],
  { provider, model }: EvalDeps
): Promise<EvalReport> {
  const results: EvalCaseResult[] = [];
  for (const c of cases) {
    let output = '';
    try {
      const r = await provider.complete({
        tenantId: 'eval',
        task: 'call_summary',
        model,
        messages: buildCallSummaryMessages(c.transcript),
        maxTokens: 500,
        temperature: 0.1,
        json: true,
        dataHandling: 'no_retention'
      });
      output = r.text;
    } catch (e) {
      results.push({ id: c.id, pass: false, reasons: [String(e)], output });
      continue;
    }
    results.push(scoreCallSummary(c, output));
  }
  return finish('call_summary', model, results);
}

export function finish(task: LlmTask, model: string, results: EvalCaseResult[]): EvalReport {
  const passed = results.filter((r) => r.pass).length;
  return { task, model, total: results.length, passed, rate: passed / results.length, results };
}
