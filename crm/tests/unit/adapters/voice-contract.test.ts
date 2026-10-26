import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@/server/adapters/errors';
import { ElevenLabsVoiceProvider } from '@/server/adapters/voice/elevenlabs';
import { RetellVoiceProvider } from '@/server/adapters/voice/retell';
import { FakeVoiceProvider } from '@/server/adapters/voice/fake';
import type { VoiceProvider } from '@/server/adapters/voice/types';

const fixture = (name: string, dir = 'elevenlabs') =>
  readFileSync(new URL(`../../fixtures/${dir}/${name}.json`, import.meta.url), 'utf8');

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

function signRetell(body: string, at = NOW, key = 'key_test') {
  const v = String(at.getTime());
  const d = createHmac('sha256', key).update(`${body}${v}`).digest('hex');
  return { 'X-Retell-Signature': `v=${v},d=${d}` };
}

function makeRetell(
  fetchImpl: typeof fetch = async () =>
    jsonResponse(JSON.parse(fixture('create-call-response', 'retell')))
) {
  return new RetellVoiceProvider({
    apiKey: 'key_test',
    fromNumber: '+15555550100',
    fetch: fetchImpl,
    now: () => NOW
  });
}

type Case = {
  name: string;
  make: () => VoiceProvider;
  /** A call-ended webhook for provider call `conv_01test`, signed validly or not. */
  webhook: (valid: boolean) => {
    headers: Record<string, string>;
    body: string;
  };
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
  },
  {
    name: 'retell (recorded-shape fixtures)',
    make: () => makeRetell(),
    webhook: (valid) => {
      const body = fixture('call-ended', 'retell');
      return {
        headers: signRetell(body, NOW, valid ? 'key_test' : 'wrong'),
        body
      };
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
    await expect(v.startOutboundCall(input)).rejects.toMatchObject({
      kind: 'transient'
    });
  });

  it('fails with a config error when no phone number is set', async () => {
    const v = new ElevenLabsVoiceProvider({
      apiKey: 'k',
      webhookSecret: SECRET
    });
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
    const body = JSON.stringify({
      type: 'post_call_audio',
      data: { conversation_id: 'c' }
    });
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

describe('RetellVoiceProvider', () => {
  it('starts a call with the documented request shape', async () => {
    const f = vi.fn(async () =>
      jsonResponse(JSON.parse(fixture('create-call-response', 'retell')))
    );
    const r = await makeRetell(f as unknown as typeof fetch).startOutboundCall({
      ...input,
      context: { first_name: 'Sam', n: 2 }
    });
    expect(r).toEqual({ providerCallId: 'conv_01test' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://api.retellai.com/v2/create-phone-call');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer key_test');
    expect(JSON.parse(init.body as string)).toEqual({
      from_number: '+15555550100',
      to_number: '+15555550101',
      override_agent_id: 'agent_test',
      retell_llm_dynamic_variables: { first_name: 'Sam', n: '2' },
      metadata: { tenant_id: 't1', contact_id: 'c1' }
    });
  });

  it('does not call the API twice for one idempotency key', async () => {
    const f = vi.fn(async () =>
      jsonResponse(JSON.parse(fixture('create-call-response', 'retell')))
    );
    const v = makeRetell(f as unknown as typeof fetch);
    await v.startOutboundCall(input);
    await v.startOutboundCall(input);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it.each([
    [401, 'config'],
    [422, 'permanent'],
    [429, 'transient'],
    [503, 'transient']
  ])('maps HTTP %i to a %s error', async (status, kind) => {
    const v = makeRetell(async () => jsonResponse({ message: 'secret echo' }, status));
    const err = await v.startOutboundCall(input).catch((e: unknown) => e);
    expect(err).toMatchObject({ kind, code: `http_${status}` });
    expect((err as Error).message).not.toContain('secret echo');
  });

  it('treats a network failure as transient', async () => {
    const v = makeRetell(async () => {
      throw new Error('ECONNRESET');
    });
    await expect(v.startOutboundCall(input)).rejects.toMatchObject({
      kind: 'transient'
    });
  });

  it('fails with a config error when no from-number is set', async () => {
    const v = new RetellVoiceProvider({ apiKey: 'k' });
    await expect(v.startOutboundCall(input)).rejects.toMatchObject({
      kind: 'config',
      code: 'no_phone_number'
    });
  });

  it('rejects a stale timestamp, a tampered body and a missing header', () => {
    const v = makeRetell();
    const body = fixture('call-ended', 'retell');
    const old = new Date(NOW.getTime() - 6 * 60_000);
    expect(() => v.parseWebhook(signRetell(body, old), body)).toThrow(/signature/);
    expect(() => v.parseWebhook(signRetell(body), body.replace('booked', 'lost'))).toThrow(
      /signature/
    );
    expect(() => v.parseWebhook({}, body)).toThrow(/signature/);
  });

  it('extracts transcript, summary, sentiment, data points, recording and cost', () => {
    const body = fixture('call-ended', 'retell');
    const e = makeRetell().parseWebhook(signRetell(body), body);
    expect(e.transcript).toBe(
      'Alex: Hi, this is Alex calling for Test Roofing.\nLead: Yes, tomorrow morning works.'
    );
    expect(e.summary).toBe('Lead agreed to an estimate tomorrow morning.');
    expect(e.sentiment).toBe('positive');
    expect(e.extracted).toEqual({ outcome: 'booked', service: 'roof repair' });
    expect(e.recordingUrl).toBe('https://retell-recordings.example/conv_01test.wav');
    expect(e.costCents).toBe(13);
    expect(e.startedAt.toISOString()).toBe(new Date(1792989900000).toISOString());
  });

  it('reports a call that never connected as a failed outcome', () => {
    const body = fixture('call-not-connected', 'retell');
    const e = makeRetell().parseWebhook(signRetell(body), body);
    expect(e).toMatchObject({
      externalId: 'conv_02test',
      kind: 'call.ended',
      durationS: 0,
      outcome: 'failed:dial_no_answer'
    });
  });

  it('refuses event types it does not handle', () => {
    const body = JSON.stringify({
      event: 'call_analyzed',
      call: { call_id: 'c' }
    });
    expect(() => makeRetell().parseWebhook(signRetell(body), body)).toThrow(/Unhandled/);
  });

  it('looks up the recording URL with the API key', async () => {
    const f = vi.fn(async () => jsonResponse({ recording_url: 'https://r.example/a.wav' }));
    const url = await makeRetell(f as unknown as typeof fetch).getRecordingUrl('conv_01test');
    expect(url).toBe('https://r.example/a.wav');
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(
      'https://api.retellai.com/v2/get-call/conv_01test'
    );
  });
});
