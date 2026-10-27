import { describe, expect, it, vi } from 'vitest';
import { ProviderError } from '@/server/adapters/errors';
import { TwilioSmsProvider, twilioSignature } from '@/server/adapters/sms/twilio';

const BASE = 'https://portal.example.test';
const TOKEN = 'test-auth-token-0000000000000000';

function provider(fetchImpl?: typeof fetch) {
  return new TwilioSmsProvider({
    accountSid: 'ACtest',
    authToken: TOKEN,
    publicBaseUrl: BASE,
    fetch: fetchImpl
  });
}

function signed(path: string, params: Record<string, string>) {
  const body = new URLSearchParams(params);
  const sig = twilioSignature(TOKEN, `${BASE}${path}`, body);
  return { headers: { 'x-twilio-signature': sig }, raw: body.toString() };
}

describe('twilio signature (F-74)', () => {
  it('matches the published Twilio example', () => {
    // From Twilio's request-validation docs.
    const params = new URLSearchParams({
      CallSid: 'CA1234567890ABCDE',
      Caller: '+12349013030',
      Digits: '1234',
      From: '+12349013030',
      To: '+18005551212'
    });
    expect(twilioSignature('12345', 'https://mycompany.com/myapp.php?foo=1&bar=2', params)).toBe(
      '0/KCTR6DLpKmkAf8muzZqo1nDgQ='
    );
  });

  it('accepts a correct status callback and maps non-final states to sent', () => {
    const { headers, raw } = signed('/api/hooks/twilio/status', {
      MessageSid: 'SM1',
      MessageStatus: 'sending',
      From: '+15555550100',
      To: '+15555550102'
    });
    expect(provider().parseStatusCallback(headers, raw)).toMatchObject({
      providerId: 'SM1',
      status: 'sent',
      fromE164: '+15555550100'
    });
  });

  it('carries the error code on a failed status', () => {
    const { headers, raw } = signed('/api/hooks/twilio/status', {
      MessageSid: 'SM2',
      MessageStatus: 'undelivered',
      ErrorCode: '30003'
    });
    expect(provider().parseStatusCallback(headers, raw)).toMatchObject({
      status: 'undelivered',
      errorCode: '30003'
    });
  });

  it('rejects a missing, wrong or cross-path signature', () => {
    const p = { MessageSid: 'SM3', From: '+15555550102', To: '+15555550100', Body: 'hi' };
    const good = signed('/api/hooks/twilio/inbound', p);
    expect(() => provider().parseInbound({}, good.raw)).toThrow(ProviderError);
    expect(() => provider().parseInbound({ 'x-twilio-signature': 'nope' }, good.raw)).toThrow(
      ProviderError
    );
    // A signature for the status URL is not valid on the inbound URL.
    const other = signed('/api/hooks/twilio/status', p);
    expect(() => provider().parseInbound(other.headers, other.raw)).toThrow(ProviderError);
    // A tampered body fails.
    expect(() => provider().parseInbound(good.headers, good.raw + '&x=1')).toThrow(ProviderError);
  });

  it('flags STOP and HELP keywords, case and whitespace aside', () => {
    const parse = (body: string) => {
      const { headers, raw } = signed('/api/hooks/twilio/inbound', {
        MessageSid: 'SM4',
        From: '+15555550102',
        To: '+15555550100',
        Body: body
      });
      return provider().parseInbound(headers, raw);
    };
    expect(parse('  Stop ').isStop).toBe(true);
    expect(parse('QUIT').isStop).toBe(true);
    expect(parse('stop texting me please').isStop).toBe(false);
    expect(parse('HELP').isHelp).toBe(true);
  });
});

describe('twilio send', () => {
  const input = {
    tenantId: 't',
    toE164: '+15555550102',
    fromE164: '+15555550100',
    body: 'hello',
    idempotencyKey: 'key-1'
  };
  const reply = (status: number, json: object) =>
    vi.fn(async () => new Response(JSON.stringify(json), { status })) as unknown as typeof fetch;

  it('posts the message with the idempotency token and returns the sid', async () => {
    const f = reply(201, { sid: 'SM9' });
    expect(await provider(f).send(input)).toEqual({ providerId: 'SM9' });
    const [url, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [
      string,
      RequestInit
    ];
    expect(url).toContain('/Accounts/ACtest/Messages.json');
    expect((init.headers as Record<string, string>)['I-Twilio-Idempotency-Token']).toBe('key-1');
    expect(String(init.body)).toContain('StatusCallback=');
  });

  it('treats 30034 as a permanent registration error', async () => {
    await expect(provider(reply(400, { code: 30034 })).send(input)).rejects.toMatchObject({
      kind: 'permanent',
      code: 'a2p_not_registered'
    });
  });

  it('treats 5xx and 429 as transient, 401 as config, bad numbers as permanent', async () => {
    await expect(provider(reply(503, {})).send(input)).rejects.toMatchObject({ kind: 'transient' });
    await expect(provider(reply(429, {})).send(input)).rejects.toMatchObject({ kind: 'transient' });
    await expect(provider(reply(401, {})).send(input)).rejects.toMatchObject({ kind: 'config' });
    await expect(provider(reply(400, { code: 21211 })).send(input)).rejects.toMatchObject({
      kind: 'permanent',
      code: 'invalid_number'
    });
    await expect(provider().send({ ...input, toE164: '555' })).rejects.toMatchObject({
      kind: 'permanent'
    });
  });
});
