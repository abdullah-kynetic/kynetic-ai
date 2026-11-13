import { afterEach, describe, expect, it, vi } from 'vitest';

// P0-4: a missing provider key must not stop the worker's boot (backups, reports, digests), while
// calls still refuse to run.
function productionEnvWithoutProviderKeys() {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_BASE_URL', 'https://portal.example.test');
  vi.stubEnv('DATABASE_URL', 'postgres://app:synthetic@localhost:5432/kynetic');
  vi.stubEnv('DATABASE_URL_AUTH', 'postgres://auth:synthetic@localhost:5432/kynetic');
  vi.stubEnv('BETTER_AUTH_SECRET', 'synthetic-auth-secret-long-enough-for-tests');
  vi.stubEnv('APP_ENCRYPTION_KEY', 'synthetic-encryption-key-long-enough-tests');
  vi.stubEnv('PROVIDER_MODE', 'live');
  vi.stubEnv('OUTBOUND_ENABLED', 'false');
  vi.stubEnv('ELEVENLABS_LIVE_ENABLED', 'true');
  for (const k of [
    'ELEVENLABS_API_KEY',
    'ELEVENLABS_WEBHOOK_SECRET',
    'TWILIO_ACCOUNT_SID',
    'TWILIO_AUTH_TOKEN'
  ])
    vi.stubEnv(k, undefined);
}

describe('worker boot with a missing provider', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('registerIfAvailable logs and skips a provider that throws, and reports success otherwise', async () => {
    const { registerIfAvailable } = await import('@/server/worker-boot');
    const lines: string[] = [];
    const ok = vi.fn();
    expect(registerIfAvailable('good', ok, (l) => lines.push(l))).toBe(true);
    expect(ok).toHaveBeenCalledOnce();
    expect(
      registerIfAvailable(
        'broken',
        () => {
          throw new Error('ELEVENLABS_API_KEY and ELEVENLABS_WEBHOOK_SECRET are required');
        },
        (l) => lines.push(l)
      )
    ).toBe(false);
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0])).toMatchObject({ level: 'error', provider: 'broken' });
  });

  it('boots in production with no ElevenLabs or Twilio keys, but the voice provider still refuses', async () => {
    productionEnvWithoutProviderKeys();
    vi.resetModules();
    const lines: string[] = [];
    const { registerProviderProcessors } = await import('@/server/worker-boot');
    const { getVoiceProvider } = await import('@/server/calls/provider');
    const { getSmsProvider } = await import('@/server/messaging/provider');

    expect(registerProviderProcessors((l) => lines.push(l))).toEqual({ voice: false, sms: false });
    expect(lines).toHaveLength(2);

    // Fail-closed: no provider, so no call can be placed and no unsigned webhook is accepted.
    expect(() => getVoiceProvider('elevenlabs')).toThrow(/required in production/);
    expect(() => getSmsProvider()).toThrow(/required in production/);
  });
});
