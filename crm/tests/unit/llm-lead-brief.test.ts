import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeLlmProvider } from '@/server/adapters/llm/fake';
import { EVAL_PASS_RATE, runLeadBriefEval, type LeadBriefCase } from '@/server/llm/evals';
import { normalizeForQuote, parseLeadBrief, verifyFact } from '@/server/llm/features/lead-brief';

const cases = JSON.parse(readFileSync('llm-evals/lead-brief.json', 'utf8')) as LeadBriefCase[];
const sources = [
  { id: 'note:1', text: 'Wants new cabinets before Thanksgiving.\nSpouse signs off.' }
];

describe('the evidence rule', () => {
  it('a word-for-word quote in the named source is strong, ignoring case and spacing', () => {
    expect(
      verifyFact(
        {
          claim: 'Wants cabinets',
          sourceId: 'note:1',
          quote: 'new   CABINETS before thanksgiving'
        },
        sources
      ).strength
    ).toBe('strong');
  });
  it('a paraphrase, a wrong source, a short quote or no quote is weak', () => {
    const f = (sourceId: string, quote: string) =>
      verifyFact({ claim: 'c', sourceId, quote }, sources).strength;
    expect(f('note:1', 'wants shiny new cabinets')).toBe('weak');
    expect(f('note:2', 'new cabinets')).toBe('weak');
    expect(f('note:1', 'new')).toBe('weak');
    expect(f('note:1', '')).toBe('weak');
  });
  it('normalizes curly quotes', () => {
    expect(normalizeForQuote('It’s  “fine”')).toBe('it\'s "fine"');
  });
  it('caps facts and rejects a brief with no headline', () => {
    const many = {
      headline: 'h',
      facts: Array.from({ length: 20 }, (_, i) => ({ claim: `c${i}`, source_id: 'x', quote: 'q' }))
    };
    expect(parseLeadBrief(JSON.stringify(many), sources).facts).toHaveLength(8);
    expect(() => parseLeadBrief('{"facts":[]}', sources)).toThrow(/headline/);
  });
});

describe('P5-6 lead brief eval harness', () => {
  it('a model that invents facts fails the bar', async () => {
    const liar = new FakeLlmProvider();
    liar.respond = () =>
      JSON.stringify({
        headline: 'h',
        facts: [
          {
            claim: 'Has a large budget and wants a bathroom',
            source_id: 'contact',
            quote: 'budget bathroom'
          },
          { claim: 'Agreed to marketing texts', source_id: 'contact', quote: 'agreed' }
        ]
      });
    const r = await runLeadBriefEval(cases, { provider: liar, model: 'x' });
    expect(r.rate).toBeLessThan(EVAL_PASS_RATE.lead_brief);
  });
});
