import { describe, expect, it } from 'vitest';
import { ProviderError } from '@/server/adapters/errors';
import { FakeEmailProvider } from '@/server/adapters/email/fake';
import { FakeSmsProvider } from '@/server/adapters/sms/fake';
import { FakeStorage } from '@/server/adapters/storage/fake';
import { FakeVoiceProvider } from '@/server/adapters/voice/fake';

const good = { 'x-fake-signature': 'valid' };
const bad = { 'x-fake-signature': 'nope' };

describe('voice adapter contract (fake)', () => {
  const input = {
    tenantId: 't1',
    contactId: 'c1',
    toE164: '+15555550101',
    agentId: 'a1',
    context: {},
    idempotencyKey: 'k1'
  };

  it('is idempotent on idempotencyKey', async () => {
    const v = new FakeVoiceProvider();
    const a = await v.startOutboundCall(input);
    const b = await v.startOutboundCall(input);
    expect(b).toEqual(a);
    expect(v.calls).toHaveLength(1);
  });

  it('rejects a non-E.164 number as a permanent error', async () => {
    const v = new FakeVoiceProvider();
    await expect(v.startOutboundCall({ ...input, toE164: '5555550101' })).rejects.toMatchObject({
      kind: 'permanent'
    });
  });

  it('verifies the webhook signature and parses the event', () => {
    const v = new FakeVoiceProvider();
    const body = JSON.stringify({
      externalId: 'e1',
      providerCallId: 'p1',
      kind: 'call.ended',
      direction: 'outbound',
      startedAt: '2026-10-26T10:00:00Z',
      durationS: 42,
      outcome: 'booked'
    });
    expect(v.parseWebhook(good, body).startedAt).toBeInstanceOf(Date);
    expect(() => v.parseWebhook(bad, body)).toThrow(ProviderError);
  });
});

describe('sms adapter contract (fake)', () => {
  it('is idempotent and rejects bad numbers', async () => {
    const s = new FakeSmsProvider();
    const i = {
      tenantId: 't',
      toE164: '+15555550102',
      fromE164: '+15555550100',
      body: 'hi',
      idempotencyKey: 'k'
    };
    expect(await s.send(i)).toEqual(await s.send(i));
    expect(s.sent).toHaveLength(1);
    await expect(s.send({ ...i, toE164: 'x', idempotencyKey: 'k2' })).rejects.toBeInstanceOf(
      ProviderError
    );
  });

  it('flags STOP and HELP on inbound and verifies signatures', () => {
    const s = new FakeSmsProvider();
    const body = (b: string) =>
      JSON.stringify({
        providerId: 'm',
        fromE164: '+15555550102',
        toE164: '+15555550100',
        body: b
      });
    expect(s.parseInbound(good, body('STOP')).isStop).toBe(true);
    expect(s.parseInbound(good, body('help')).isHelp).toBe(true);
    expect(s.parseInbound(good, body('hello')).isStop).toBe(false);
    expect(() => s.parseInbound(bad, body('STOP'))).toThrow(ProviderError);
  });
});

describe('email adapter contract (fake)', () => {
  it('is idempotent, rejects bad recipients and verifies webhooks', async () => {
    const e = new FakeEmailProvider();
    const i = {
      tenantId: 't',
      to: 'a@example.com',
      fromName: 'N',
      fromAddress: 'n@mail.example.com',
      subject: 's',
      html: '<p>x</p>',
      text: 'x',
      idempotencyKey: 'k'
    };
    expect(await e.send(i)).toEqual(await e.send(i));
    await expect(e.send({ ...i, to: 'nope', idempotencyKey: 'k2' })).rejects.toBeInstanceOf(
      ProviderError
    );
    const body = JSON.stringify({ providerId: 'p', kind: 'bounced', address: 'a@example.com' });
    expect(e.parseWebhook(good, body).kind).toBe('bounced');
    expect(() => e.parseWebhook(bad, body)).toThrow(ProviderError);
  });
});

describe('storage adapter contract (fake)', () => {
  it('puts, gets and removes', async () => {
    const st = new FakeStorage();
    await st.put('t1/a.txt', new Uint8Array([1, 2]), { contentType: 'text/plain' });
    expect((await st.get('t1/a.txt'))?.body).toEqual(new Uint8Array([1, 2]));
    await st.remove('t1/a.txt');
    expect(await st.get('t1/a.txt')).toBeNull();
  });
});
