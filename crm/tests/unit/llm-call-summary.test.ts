import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeLlmProvider } from '@/server/adapters/llm/fake';
import { EVAL_PASS_RATE, runCallSummaryEval, type CallSummaryCase } from '@/server/llm/evals';
import { parseCallSummary } from '@/server/llm/features/call-summary';

const cases = JSON.parse(readFileSync('llm-evals/call-summary.json', 'utf8')) as CallSummaryCase[];

describe('call summary parsing', () => {
  it('reads a fenced answer, caps length, and turns an unknown tag into other', () => {
    const r = parseCallSummary(
      '```json\n{"summary":"  Wants   a quote. ","outcome_tag":"dnc"}\n```'
    );
    expect(r).toEqual({ summary: 'Wants a quote.', outcomeTag: 'other' });
    expect(parseCallSummary('{"summary":"x","outcome_tag":"asked_to_stop"}').outcomeTag).toBe(
      'asked_to_stop'
    );
  });
  it('rejects empty or malformed answers', () => {
    expect(() => parseCallSummary('nope')).toThrow();
    expect(() => parseCallSummary('{"summary":"","outcome_tag":"booked"}')).toThrow(/no summary/);
  });
});

describe('P5-6 call summary eval harness', () => {
  it('has the cases it needs, none with real client data marked', () => {
    expect(cases.length).toBeGreaterThanOrEqual(6);
  });

  it('an answer key scores 100% and a lazy "always booked" model fails the bar', async () => {
    const oracle = new FakeLlmProvider();
    oracle.respond = (req) => {
      const c = cases.find((x) => req.messages[1]!.content.includes(x.transcript))!;
      return JSON.stringify({
        summary: [...c.mustMention, 'call'].join(' '),
        outcome_tag: c.expectTag
      });
    };
    const good = await runCallSummaryEval(cases, { provider: oracle, model: 'oracle' });
    expect(good.rate).toBe(1);

    const lazy = new FakeLlmProvider();
    lazy.respond = () =>
      JSON.stringify({ summary: 'The customer booked an estimate.', outcome_tag: 'booked' });
    const bad = await runCallSummaryEval(cases, { provider: lazy, model: 'lazy' });
    expect(bad.rate).toBeLessThan(EVAL_PASS_RATE.call_summary);
  });
});
