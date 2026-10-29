import { afterEach, describe, expect, it, vi } from 'vitest';

function setProductionEnv(providerMode: 'stub' | 'live') {
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('APP_BASE_URL', 'https://portal.example.test');
  vi.stubEnv('DATABASE_URL', 'postgres://app:synthetic@localhost:5432/kynetic');
  vi.stubEnv('DATABASE_URL_AUTH', 'postgres://auth:synthetic@localhost:5432/kynetic');
  vi.stubEnv('BETTER_AUTH_SECRET', 'synthetic-auth-secret-long-enough-for-tests');
  vi.stubEnv('APP_ENCRYPTION_KEY', 'synthetic-encryption-key-long-enough-tests');
  vi.stubEnv('OUTBOUND_ENABLED', 'false');
  vi.stubEnv('PROVIDER_MODE', providerMode);
}

describe('provider mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses fake SMS and voice adapters in production stub mode even when live credentials exist', async () => {
    setProductionEnv('stub');
    vi.stubEnv('TWILIO_ACCOUNT_SID', 'synthetic-account');
    vi.stubEnv('TWILIO_AUTH_TOKEN', 'synthetic-token');
    vi.stubEnv('ELEVENLABS_API_KEY', 'synthetic-key');
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', 'synthetic-webhook-secret');
    vi.resetModules();

    const [{ getSmsProvider }, { FakeSmsProvider }, { getVoiceProvider }, { FakeVoiceProvider }] =
      await Promise.all([
        import('@/server/messaging/provider'),
        import('@/server/adapters/sms/fake'),
        import('@/server/calls/provider'),
        import('@/server/adapters/voice/fake')
      ]);

    expect(getSmsProvider()).toBeInstanceOf(FakeSmsProvider);
    expect(getVoiceProvider('elevenlabs')).toBeInstanceOf(FakeVoiceProvider);
  });

  it('keeps production live mode fail-closed without credentials', async () => {
    setProductionEnv('live');
    vi.stubEnv('TWILIO_ACCOUNT_SID', undefined);
    vi.stubEnv('TWILIO_AUTH_TOKEN', undefined);
    vi.stubEnv('ELEVENLABS_API_KEY', undefined);
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', undefined);
    vi.resetModules();
    const [{ getSmsProvider }, { getVoiceProvider }] = await Promise.all([
      import('@/server/messaging/provider'),
      import('@/server/calls/provider')
    ]);
    expect(() => getSmsProvider()).toThrow(/TWILIO_ACCOUNT_SID/);
    expect(() => getVoiceProvider('elevenlabs')).toThrow(/ELEVENLABS_API_KEY/);
  });
});
