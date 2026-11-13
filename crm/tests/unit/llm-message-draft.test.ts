import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { FakeLlmProvider } from '@/server/adapters/llm/fake';
import { EVAL_PASS_RATE, runMessageDraftEval, type MessageDraftCase } from '@/server/llm/evals';
import { parseMessageDraft } from '@/server/llm/features/message-draft';

const cases = JSON.parse(
  readFileSync('llm-evals/message-draft.json', 'utf8')
) as MessageDraftCase[];

describe('message draft parsing', () => {
  it('accepts a good text and a good email', () => {
    expect(
      parseMessageDraft('{"subject":null,"body":"Hi Pat, hello. Summit"}', 'sms').subject
    ).toBeNull();
    expect(parseMessageDraft('{"subject":"Hello","body":"Hi Pat"}', 'email')).toEqual({
      subject: 'Hello',
      body: 'Hi Pat'
    });
  });
  it('refuses empty, over-long, unfilled and subject-less drafts', () => {
    expect(() => parseMessageDraft('{"body":""}', 'sms')).toThrow(/no message/);
    expect(() => parseMessageDraft(`{"body":"${'x'.repeat(321)}"}`, 'sms')).toThrow(/too long/);
    expect(() => parseMessageDraft('{"body":"Hi [Name]"}', 'sms')).toThrow(/placeholder/);
    expect(() => parseMessageDraft('{"body":"Hi {{first_name}}"}', 'sms')).toThrow(/placeholder/);
    expect(() => parseMessageDraft('{"body":"Hi"}', 'email')).toThrow(/subject/);
  });
});

describe('P5-6 message draft eval harness', () => {
  it('passes good drafts and fails drafts that quote prices or talk about consent', async () => {
    const good = new FakeLlmProvider();
    good.respond = (req) => {
      const c = cases.find((x) =>
        req.messages[1]!.content.includes(`<purpose>${x.purpose}</purpose>`)
      )!;
      const name = /ignore/i.test(c.firstName) ? 'there' : c.firstName;
      return JSON.stringify({
        subject: c.channel === 'email' ? 'Note' : null,
        body: `Hi ${name}, checking in. ${c.businessName}`
      });
    };
    expect((await runMessageDraftEval(cases, { provider: good, model: 'x' })).rate).toBe(1);
    const bad = new FakeLlmProvider();
    bad.respond = () =>
      JSON.stringify({
        subject: 'Deal',
        body: 'Hi, a deck is $4,500 and you agreed to opt in. 50% off today!'
      });
    expect((await runMessageDraftEval(cases, { provider: bad, model: 'x' })).rate).toBeLessThan(
      EVAL_PASS_RATE.message_draft
    );
  });
});
