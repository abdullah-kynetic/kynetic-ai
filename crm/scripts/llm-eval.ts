// Runs each model feature's test set against a model and prints pass rates (P5-6).
//   bun scripts/llm-eval.ts                       dry run with an answer-key stand-in (checks the harness, no model)
//   bun scripts/llm-eval.ts --live [task]         real OpenRouter calls; needs OPENROUTER_API_KEY and a model per task
// The cases are synthetic. Never put real client data in them. The live run sends them to OpenRouter,
// so it only runs when Abdullah has said yes to the key.
import { readFileSync } from 'node:fs';
import { FakeLlmProvider } from '../src/server/adapters/llm/fake';
import { OpenRouterProvider } from '../src/server/adapters/llm/openrouter';
import { LLM_TASKS, type LlmProvider, type LlmTask } from '../src/server/adapters/llm/types';
import { resolveTaskConfig } from '../src/config/llm-models';
import {
  EVAL_PASS_RATE,
  runCallSummaryEval,
  runLeadBriefEval,
  runMessageDraftEval,
  type LeadBriefCase,
  type MessageDraftCase,
  type CallSummaryCase,
  type EvalReport
} from '../src/server/llm/evals';

const args = process.argv.slice(2);
const live = args.includes('--live');
const only = args.find((a) => (LLM_TASKS as readonly string[]).includes(a)) as LlmTask | undefined;

function load<T>(file: string): T[] {
  return JSON.parse(readFileSync(new URL(`../llm-evals/${file}`, import.meta.url), 'utf8')) as T[];
}

function provider(): LlmProvider {
  if (live) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) throw new Error('--live needs OPENROUTER_API_KEY');
    return new OpenRouterProvider({ apiKey });
  }
  return new FakeLlmProvider();
}

const reports: EvalReport[] = [];
for (const task of only ? [only] : LLM_TASKS) {
  const model = live ? resolveTaskConfig(task, process.env.LLM_MODELS).model : 'dry-run';
  if (task === 'call_summary') {
    const cases = load<CallSummaryCase>('call-summary.json');
    const p = provider();
    if (p instanceof FakeLlmProvider) {
      p.respond = (req) => {
        const c = cases.find((x) => req.messages[1]!.content.includes(x.transcript))!;
        return JSON.stringify({ summary: [...c.mustMention, 'call'].join(' '), outcome_tag: c.expectTag });
      };
    }
    reports.push(await runCallSummaryEval(cases, { provider: p, model }));
  }
  if (task === 'message_draft') {
    const cases = load<MessageDraftCase>('message-draft.json');
    const p = provider();
    if (p instanceof FakeLlmProvider) {
      p.respond = (req) => {
        const c = cases.find((x) => req.messages[1]!.content.includes(`<purpose>${x.purpose}</purpose>`))!;
        const name = /ignore/i.test(c.firstName) ? 'there' : c.firstName;
        return JSON.stringify({
          subject: c.channel === 'email' ? 'A note from us' : null,
          body: `Hi ${name}, a quick note about your project. ${c.businessName}`
        });
      };
    }
    reports.push(await runMessageDraftEval(cases, { provider: p, model }));
  }
  if (task === 'lead_brief') {
    const cases = load<LeadBriefCase>('lead-brief.json');
    const p = provider();
    if (p instanceof FakeLlmProvider) {
      p.respond = (req) => {
        const c = cases.find((x) => req.messages[1]!.content.includes(x.sources.at(-1)!.text))!;
        const last = c.sources.at(-1)!;
        return JSON.stringify({
          headline: 'Lead brief',
          facts: c.expectStrongTerms.map((t) => {
            const m = new RegExp(`[^.\\n]*${t}[^.\\n]*`, 'i').exec(last.text)!;
            return { claim: m[0].trim(), source_id: last.id, quote: m[0].trim() };
          })
        });
      };
    }
    reports.push(await runLeadBriefEval(cases, { provider: p, model }));
  }
}

for (const r of reports) {
  const bar = EVAL_PASS_RATE[r.task];
  console.log(
    `${r.task} model=${r.model} ${r.passed}/${r.total} (${Math.round(r.rate * 100)}%) bar ${Math.round(bar * 100)}% ${r.rate >= bar ? 'PASS' : 'FAIL'}`
  );
  for (const c of r.results.filter((x) => !x.pass)) console.log(`  - ${c.id}: ${c.reasons.join('; ')}`);
}
if (live) console.log('Live run: these are synthetic cases sent to OpenRouter; record the result in the phase report.');
process.exit(reports.every((r) => r.rate >= EVAL_PASS_RATE[r.task]) ? 0 : 1);
