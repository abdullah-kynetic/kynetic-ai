import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@/server/adapters/errors';
import { ElevenLabsVoiceProvider } from '@/server/adapters/voice/elevenlabs';
import { FakeVoiceProvider } from '@/server/adapters/voice/fake';
import type { VoiceProvider } from '@/server/adapters/voice/types';

const fixture = (name: string) =>
  readFileSync(new URL(`../../fixtures/elevenlabs/${name}.json`, import.meta.url), 'utf8');

const NOW = new Date('2026-10-26T10:00:00Z');
const SECRET = 'whsec_test';
const input = {
  tenantId: 't1',
  contactId: 'c1',
  toE164: '+15555550101',
  agentId: 'agent_test',
  context: { first_name: 'Sam' },
  idempotencyKey: 'k1'
};

function sign(body: string, at = NOW, secret = SECRET) {
  const t = Math.floor(at.getTime() / 1000);
  const v0 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
  return { 'ElevenLabs-Signature': `t=${t},v0=${v0}` };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function makeElevenLabs(
  fetchImpl: typeof fetch = async () => jsonResponse(JSON.parse(fixture('outbound-call-response')))
) {
  return new ElevenLabsVoiceProvider({
    apiKey: 'xi_test',
    webhookSecret: SECRET,
    agentPhoneNumberId: 'phnum_test',
    fetch: fetchImpl,
    now: () => NOW
  });
}

type Case = {
  name: string;
  make: () => VoiceProvider;
  /** A call-ended webhook for provider call `conv_01test`, signed validly or not. */
  webhook: (valid: boolean) => { headers: Record<string, string>; body: string };
};

const cases: Case[] = [
  {
    name: 'fake',
    make: () => new FakeVoiceProvider(),
    webhook: (valid) => ({
      headers: { 'x-fake-signature': valid ? 'valid' : 'nope' },
      body: JSON.stringify({
        externalId: 'conv_01test',
        providerCallId: 'conv_01test',
        kind: 'call.ended',
        direction: 'outbound',
        startedAt: '2026-10-26T10:00:00Z',
        durationS: 84,
        outcome: 'booked'
      })
    })
  },
  {
    name: 'elevenlabs (recorded fixtures)',
    make: () => makeElevenLabs(),
    webhook: (valid) => {
      const body = fixture('post-call-transcription');
      return { headers: sign(body, NOW, valid ? SECRET : 'wrong'), body };
    }
  }
];

describe.each(cases)('VoiceProvider contract: $name', ({ make, webhook }) => {
  it('is idempotent on idempotencyKey', async () => {
    const v = make();
    const a = await v.startOutboundCall(input);
    expect(await v.startOutboundCall(input)).toEqual(a);
  });

  it('rejects a non-E.164 number as a permanent error', async () => {
    await expect(
      make().startOutboundCall({ ...input, toE164: '5555550101' })
    ).rejects.toMatchObject({
      kind: 'permanent'
    });
  });

  it('parses a verified call-ended event', () => {
    const w = webhook(true);
    const e = make().parseWebhook(w.headers, w.body);
    expect(e).toMatchObject({
      externalId: 'conv_01test',
      providerCallId: 'conv_01test',
      kind: 'call.ended',
      direction: 'outbound',
      durationS: 84,
      outcome: 'booked'
    });
    expect(e.startedAt).toBeInstanceOf(Date);
  });

  it('rejects a bad signature without returning an event', () => {
    const w = webhook(false);
    expect(() => make().parseWebhook(w.headers, w.body)).toThrow(ProviderError);
  });
});

describe('ElevenLabsVoiceProvider', () => {
  it('starts a call with the documented request shape', async () => {
    const f = vi.fn(async () => jsonResponse(JSON.parse(fixture('outbound-call-response'))));
    const r = await makeElevenLabs(f as unknown as typeof fetch).startOutboundCall(input);
    expect(r).toEqual({ providerCallId: 'conv_01test' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.elevenlabs.io/v1/convai/twilio/outbound-call');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('xi_test');
    expect(JSON.parse(init.body as string)).toEqual({
      agent_id: 'agent_test',
      agent_phone_number_id: 'phnum_test',
      to_number: '+15555550101',
      conversation_initiation_client_data: {
        dynamic_variables: { first_name: 'Sam' },
        user_id: 't1:c1'
      }
    });
  });

  it('does not call the API twice for one idempotency key', async () => {
    const f = vi.fn(async () => jsonResponse(JSON.parse(fixture('outbound-call-response'))));
    const v = makeElevenLabs(f as unknown as typeof fetch);
    await v.startOutboundCall(input);
    await v.startOutboundCall(input);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, 'config'],
    [403, 'config'],
    [422, 'permanent'],
    [429, 'transient'],
    [503, 'transient']
  ])('maps HTTP %i to a %s error', async (status, kind) => {
    const v = makeElevenLabs(async () => jsonResponse({ detail: 'secret echo' }, status));
    const err = await v.startOutboundCall(input).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind, code: `http_${status}` });
    expect((err as Error).message).not.toContain('secret echo');
  });

  it('treats a network failure as transient', async () => {
    const v = makeElevenLabs(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(v.startOutboundCall(input)).rejects.toMatchObject({ kind: 'transient' });
  });

  it('fails with a config error when no phone number is set', async () => {
    const v = new ElevenLabsVoiceProvider({ apiKey: 'k', webhookSecret: SECRET });
    await expect(v.startOutboundCall(input)).rejects.toMatchObject({
      kind: 'config',
      code: 'no_phone_number'
    });
  });

  it('rejects a stale timestamp, a tampered body and a missing header', () => {
    const v = makeElevenLabs();
    const body = fixture('post-call-transcription');
    const old = new Date(NOW.getTime() - 6 * 60_000);
    expect(() => v.parseWebhook(sign(body, old), body)).toThrow(/signature/);
    expect(() => v.parseWebhook(sign(body), body.replace('booked', 'lost'))).toThrow(/signature/);
    expect(() => v.parseWebhook({}, body)).toThrow(/signature/);
  });

  it('accepts a lowercase header name', () => {
    const body = fixture('post-call-transcription');
    const [[, value]] = Object.entries(sign(body));
    expect(makeElevenLabs().parseWebhook({ 'elevenlabs-signature': value }, body).outcome).toBe(
      'booked'
    );
  });

  it('extracts transcript, summary, data points and the recording link', () => {
    const body = fixture('post-call-transcription');
    const e = makeElevenLabs().parseWebhook(sign(body), body);
    expect(e.transcript).toBe(
      'Alex: Hi, this is Alex calling for Test Roofing.\nLead: Yes, tomorrow morning works.'
    );
    expect(e.summary).toBe('Lead agreed to an estimate tomorrow morning.');
    expect(e.extracted).toEqual({ outcome: 'booked', service: 'roof repair' });
    expect(e.recordingUrl).toBe(
      'https://api.elevenlabs.io/v1/convai/conversations/conv_01test/audio'
    );
    expect(e.startedAt.toISOString()).toBe(new Date(1792989900 * 1000).toISOString());
  });

  it('reports a call that never connected as an ended call with a failed outcome', () => {
    const body = fixture('call-initiation-failure');
    const e = makeElevenLabs().parseWebhook(sign(body), body);
    expect(e).toMatchObject({
      externalId: 'conv_02test:call_initiation_failure',
      kind: 'call.ended',
      durationS: 0,
      outcome: 'failed:no-answer'
    });
  });

  it('refuses event types it does not handle', () => {
    const body = JSON.stringify({ type: 'post_call_audio', data: { conversation_id: 'c' } });
    expect(() => makeElevenLabs().parseWebhook(sign(body), body)).toThrow(/Unhandled/);
  });

  it('fetches the recording with the API key', async () => {
    const f = vi.fn(async () => new Response(new Uint8Array([1, 2, 3])));
    const bytes = await makeElevenLabs(f as unknown as typeof fetch).fetchRecording('conv_01test');
    expect(bytes).toEqual(new Uint8Array([1, 2, 3]));
    const init = (f.mock.calls[0] as unknown as [string, RequestInit])[1];
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('xi_test');
  });
});
