import { afterEach, describe, expect, it, vi } from 'vitest';
import { getEmailProvider, setEmailProvider } from '@/server/adapters/email';
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
  vi.restoreAllMocks();
});

describe('wireEmail', () => {
  it('wires Resend once per process when a key is set', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const env = parseEnv({ ...baseEnv, RESEND_API_KEY: 'synthetic-resend-key' });
    expect(wireEmail(env)).toBe('resend');
    expect(wireEmail(env)).toBe('resend');
    expect(getEmailProvider().id).toBe('resend');
  });

  it('leaves the email provider unset when Resend is not configured', () => {
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    expect(wireEmail(parseEnv(baseEnv))).toBe('none');
    expect(() => getEmailProvider()).toThrow('No email provider is configured');
  });
});
