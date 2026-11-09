import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEmailProvider, setEmailProvider } from '@/server/adapters/email';
import {
  sendMagicLinkEmail,
  sendSecurityNotice,
  sendSignInCode,
  setMagicLinkSender,
  setSecurityNoticeSender,
  setSignInCodeSender
} from '@/server/auth';
import { parseEnv } from '@/server/env';
import { wireEmail } from '@/server/email/wire';

const baseEnv = {
  APP_BASE_URL: 'https://portal.example.test',
  DATABASE_URL: 'postgres://synthetic:synthetic@127.0.0.1:55432/portal',
  DATABASE_URL_AUTH: 'postgres://synthetic:synthetic@127.0.0.1:55432/portal',
  BETTER_AUTH_SECRET: 'synthetic-better-auth-secret-long-enough',
  APP_ENCRYPTION_KEY: 'synthetic-app-encryption-key-long-enough',
  EMAIL_FROM_ADDRESS: 'notifications@mail.example.test'
};

afterEach(() => {
  setEmailProvider(undefined);
  setMagicLinkSender(undefined);
  setSignInCodeSender(undefined);
  setSecurityNoticeSender(undefined);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('wireEmail', () => {
  it('wires Resend and sends an escaped, idempotent magic link using fake fetch', async () => {
    let request: { input: RequestInfo | URL; init?: RequestInit } | undefined;
    const fakeFetch: typeof fetch = async (input, init) => {
      request = { input, init };
      return new Response(JSON.stringify({ id: 'email_synthetic_1' }), { status: 200 });
    };
    vi.stubGlobal('fetch', fakeFetch);
    vi.spyOn(console, 'log').mockImplementation(() => undefined);

    const env = parseEnv({ ...baseEnv, RESEND_API_KEY: 'synthetic-resend-key' });
    expect(wireEmail(env)).toBe('resend');
    expect(wireEmail(env)).toBe('resend');
    expect(getEmailProvider().id).toBe('resend');

    const url = 'https://portal.example.test/magic?token=a%22b&next=%3Cscript%3E';
    await sendMagicLinkEmail({ email: 'owner@example.test', url });

    expect(String(request?.input)).toBe('https://api.resend.com/emails');
    expect(request?.init?.method).toBe('POST');
    const headers = new Headers(request?.init?.headers);
    expect(headers.get('idempotency-key')).toBe(
      `magic-link:${createHash('sha256').update(url).digest('hex')}`
    );
    const body = JSON.parse(String(request?.init?.body)) as {
      from: string;
      to: string[];
      subject: string;
      html: string;
      text: string;
    };
    expect(body.from).toBe('Kynetic AI <notifications@mail.example.test>');
    expect(body.to).toEqual(['owner@example.test']);
    expect(body.subject).toBe('Your Kynetic sign-in link');
    expect(body.html).toContain(
      'href="https://portal.example.test/magic?token=a%22b&amp;next=%3Cscript%3E"'
    );
    expect(body.text).toContain(url);
    expect(body.text).toContain('expires in 15 minutes');

    await sendSignInCode({ email: 'owner@example.test', code: '123456' });
    const codeBody = JSON.parse(String(request?.init?.body)) as { subject: string; text: string };
    expect(codeBody.subject).toBe('Your Kynetic sign-in code');
    expect(codeBody.text).toContain('123456');
    expect(codeBody.text).toContain('10 minutes');
  });

  it('leaves both email senders unset when Resend is not configured', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(wireEmail(parseEnv(baseEnv))).toBe('none');
    expect(() => getEmailProvider()).toThrow('No email provider is configured');
    await expect(
      sendMagicLinkEmail({ email: 'owner@example.test', url: 'https://portal.example.test/magic' })
    ).rejects.toThrow('No email sender is configured for sign-in links');
    await expect(sendSignInCode({ email: 'owner@example.test', code: '123456' })).rejects.toThrow(
      'No email sender is configured for sign-in codes'
    );
    await expect(
      sendSecurityNotice({
        email: 'owner@example.test',
        subject: 'notice',
        text: 'notice',
        html: '<p>notice</p>',
        idempotencyKey: 'totp-reset:test'
      })
    ).rejects.toThrow('No email sender is configured for security notices');
  });
});
