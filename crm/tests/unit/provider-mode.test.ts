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

  it('M13-02 F-78: defaults ElevenLabs to a working idempotent stub even with synthetic live credentials', async () => {
    setProductionEnv('live');
    vi.stubEnv('ELEVENLABS_LIVE_ENABLED', undefined);
    vi.stubEnv('ELEVENLABS_API_KEY', 'synthetic-key');
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', 'synthetic-hook-key');
    const fetcher = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network forbidden'));
    vi.resetModules();
    const { getVoiceProvider } = await import('@/server/calls/provider');
    const { FakeVoiceProvider } = await import('@/server/adapters/voice/fake');
    try {
      const provider = getVoiceProvider('elevenlabs');
      expect(provider).toBeInstanceOf(FakeVoiceProvider);
      const input = {
        tenantId: 'synthetic',
        contactId: 'synthetic',
        agentId: 'synthetic-agent',
        toE164: '+15555550123',
        context: {},
        idempotencyKey: 'synthetic-attempt-1'
      };
      expect(await provider!.startOutboundCall(input)).toEqual(
        await provider!.startOutboundCall(input)
      );
      expect(fetcher).not.toHaveBeenCalled();
    } finally {
      fetcher.mockRestore();
    }
  });

  it('M13-02 F-78: selects the real adapter only behind the explicit opt-in without making a call', async () => {
    setProductionEnv('live');
    vi.stubEnv('ELEVENLABS_LIVE_ENABLED', 'true');
    vi.stubEnv('ELEVENLABS_API_KEY', 'synthetic-key');
    vi.stubEnv('ELEVENLABS_WEBHOOK_SECRET', 'synthetic-hook-key');
    vi.resetModules();
    const { getVoiceProvider } = await import('@/server/calls/provider');
    const { ElevenLabsVoiceProvider } = await import('@/server/adapters/voice/elevenlabs');
    expect(getVoiceProvider('elevenlabs')).toBeInstanceOf(ElevenLabsVoiceProvider);
  });

  it('keeps production live mode fail-closed without credentials', async () => {
    setProductionEnv('live');
    vi.stubEnv('ELEVENLABS_LIVE_ENABLED', 'true');
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
