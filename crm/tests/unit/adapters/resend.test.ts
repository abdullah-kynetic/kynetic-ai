import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ResendEmailProvider } from '@/server/adapters/email/resend';

const secretBytes = Buffer.from('resend-test-secret-bytes-0123456789');
const webhookSecret = `whsec_${secretBytes.toString('base64')}`;
const now = new Date('2026-10-26T10:00:00Z');
const ts = String(Math.floor(now.getTime() / 1000));

function signed(body: string, id = 'msg_1', timestamp = ts) {
  const sig = createHmac('sha256', secretBytes)
    .update(`${id}.${timestamp}.${body}`)
    .digest('base64');
  return { 'svix-id': id, 'svix-timestamp': timestamp, 'svix-signature': `v1,${sig}` };
}
const provider = (f?: typeof fetch) =>
  new ResendEmailProvider({ apiKey: 'k', webhookSecret, fetch: f, now: () => now });
const evt = (type: string) =>
  JSON.stringify({ type, data: { email_id: 'em_1', to: ['Owner@Example.test'] } });

describe('Resend webhook', () => {
  it('maps bounce, complaint and delivery, lower-casing the address', () => {
    for (const [type, kind] of [
      ['email.bounced', 'bounced'],
      ['email.complained', 'complained'],
      ['email.delivered', 'delivered']
    ] as const) {
      const body = evt(type);
      expect(provider().parseWebhook(signed(body), body)).toEqual({
        providerId: 'em_1',
        kind,
        address: 'owner@example.test'
      });
    }
  });

  it('rejects a bad, missing or stale signature', () => {
    const body = evt('email.bounced');
    const p = provider();
    expect(() => p.parseWebhook({ ...signed(body), 'svix-signature': 'v1,AAAA' }, body)).toThrow(
      /Signature/
    );
    expect(() => p.parseWebhook({}, body)).toThrow(/Signature/);
    expect(() => p.parseWebhook(signed(body, 'm', String(Number(ts) - 600)), body)).toThrow(
      /Signature/
    );
    expect(() => p.parseWebhook(signed(body), body + ' ')).toThrow(/Signature/);
  });

  it('flags event types it does not act on', () => {
    const body = evt('email.opened');
    expect(() => provider().parseWebhook(signed(body), body)).toThrow(
      expect.objectContaining({ code: 'ignored_event' })
    );
  });
});

describe('Resend send', () => {
  const input = {
    tenantId: 't',
    to: 'a@example.test',
    fromName: 'Biz',
    fromAddress: 'biz@mail.example.test',
    subject: 's',
    html: '<p>x</p>',
    text: 'x',
    idempotencyKey: 'k1'
  };

  it('posts with the idempotency key and returns the id', async () => {
    let seen: RequestInit | undefined;
    const f = (async (_u: unknown, init: RequestInit) => {
      seen = init;
      return new Response(JSON.stringify({ id: 'em_9' }), { status: 200 });
    }) as unknown as typeof fetch;
    expect(await provider(f).send(input)).toEqual({ providerId: 'em_9' });
    const sentHeaders = (seen?.headers ?? {}) as Record<string, string>;
    expect(sentHeaders['Idempotency-Key']).toBe('k1');
  });

  it('normalises failures', async () => {
    const reply = (status: number) =>
      provider((async () => new Response('{}', { status })) as unknown as typeof fetch).send(input);
    await expect(reply(500)).rejects.toMatchObject({ kind: 'transient' });
    await expect(reply(429)).rejects.toMatchObject({ kind: 'transient' });
    await expect(reply(401)).rejects.toMatchObject({ kind: 'config' });
    await expect(reply(422)).rejects.toMatchObject({ kind: 'permanent' });
  });
});
